const express = require("express");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

const serviceAccount = require("./knureviewapp-firebase-adminsdk-981au-22c73372a2.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const VERIFICATION_TIMEOUT = 5 * 60 * 1000; // 5분 시간 제한
const JWT_SECRET = "jwt_secret_0b0000_1111";

// 이메일 중복 여부 판단 api
app.post("/api/verify-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send("Invalid request");
  }

  const user = await admin
    .auth()
    .getUserByEmail(email)
    .catch((err) => null);

  if (user) {
    return res.status(409).send("Email already exists");
  }

  // const token = await admin.auth().createCustomToken(email)
  const customToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });
  const verificationCode = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  const verificationDoc = db.collection("verifications").doc(email);
  const existingVerification = await verificationDoc.get();

  if (existingVerification.exists) {
    await verificationDoc.delete();
  }

  await verificationDoc.set({
    verificationCode,
    token: customToken,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  await admin
    .firestore()
    .collection("mail")
    .add({
      to: email,
      message: {
        subject: "강남미식회 회원가입 인증코드 입니다.",
        html: `
		<h1>강남미식회</h1></br></br></br>
		회원가입 인증코드 입니다.</br></br>
		인증코드: ${verificationCode}
		`,
      },
    });

  // TODO: Email로 Verification code 전송
  console.log(`Send verification code ${verificationCode} to ${email}`);

  res.status(200).send({ token: customToken });
});

// 인증코드 판단 api
app.post("/api/verify-code", async (req, res) => {
  const { email, code, token } = req.body;

  if (!email || !code || !token) {
    return res.status(400).send("Invalid request");
  }

  // Firestore에서 이메일로 인증 코드와 JWT 조회
  const verificationPrm = db.collection("verifications").doc(email);
  const verificationDoc = await verificationPrm.get();

  if (!verificationDoc.exists) {
    return res.status(404).send("Verification code not found");
  }

  const savedData = verificationDoc.data();
  const savedVerificationCode = savedData.verificationCode;
  const savedToken = savedData.token;
  const timestamp = savedData.timestamp.toMillis(); // Firestore의 Timestamp 객체를 밀리초로 변환

  const currentTime = Date.now();
  if (currentTime - timestamp > VERIFICATION_TIMEOUT) {
    // 인증 코드가 5분을 초과했으면 만료 처리
    await verificationDoc.ref.delete();
    return res.status(410).send("Verification code expired");
  }

  // 제출된 JWT와 Firestore에 저장된 JWT 비교
  if (token != savedToken) {
    return res.status(401).send("Invalid token");
  }

  if (code != savedVerificationCode) {
    return res.status(401).send("Invalid verification code");
  }

  // 인증이 완료되면 Firestore에서 인증 데이터를 삭제
  await verificationDoc.ref.delete();

  res.status(200).send({ token });
});

// 닉네임 중복 여부 판단 api
app.post("/api/verify-nickname", async (req, res) => {
  const { nickname, token } = req.body;

  if (!nickname || !token) {
    return res.status(400).send("Invalid request");
  }

  const userDoc = db.collection("users");
  const nicknameQuery = await userDoc.where("nickname", "==", nickname).get();

  if (!nicknameQuery.empty) {
    return res.status(409).send("NickName already exists");
  }

  res.sendStatus(200);
});

// 회원가입 api
app.post("/api/register", async (req, res) => {
  const { email, password, nickname, token } = req.body;

  if (!email || !password || !nickname || !token) {
    return res.status(400).send("Invalid request");
  }

  const account = await admin
    .auth()
    .getUserByEmail(email)
    .catch((err) => null);

  if (account) {
    return res.status(409).send("Email already exists");
  }

  const user = await admin.auth().createUser({
    email: email,
    password: password,
    displayName: nickname,
  });

  await db.collection("users").doc(email).set({
    nickname: nickname,
    photoURL: null,
  });

  // business logic
  res.status(200).send(user);
});

// 로그인 api
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  console.log(email, password);

  if (!email || !password) {
    return res.status(400).send("Invalid request");
  }

  // const userRecord = await admin.auth().getUserByEmail(email);
  // const userData = userDoc.data();
  // res.status(200).send({
  //   email: userRecord.email,
  //   nickname: userData.nickname,
  //   photoURL: userData.photoURL,
  // });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
