const express = require("express");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const { searchBusiness, categorizeRestaurant } = require("./common");

const app = express();
app.use(express.json());

const serviceAccount = require("./knureviewapp-firebase-adminsdk-981au-22c73372a2.json");
const { getStorage } = require("firebase-admin/storage");
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
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).send("Invalid request");
  }

  const user = await admin.auth().getUser(uid);

  if (!user) {
    return res.status(401).send("User not found");
  }

  const idToken = await admin.auth().createCustomToken(uid);
  const user_uid = user.uid;
  const email = user.email;
  const nickname = user.displayName;
  const photoURL =
    user.photoURL !== undefined && user.photoURL !== null
      ? user.photoURL
      : null; // 정확한 null 처리

  res.status(200).send({
    accessToken: idToken,
    uid: user_uid,
    email: email,
    nickname: nickname,
    photoURL: photoURL,
  });
});

// 회원탈퇴 api
app.post("/api/delete-account", async (req, res) => {
  const { uid, email } = req.body;

  if (!uid || !email) {
    return res.status(400).send("Invalid request");
  }

  await admin.auth().deleteUser(uid);

  const userDocRef = db.collection("users").doc(email);
  const userDoc = await userDocRef.get();

  if (userDoc.exists) {
    await userDocRef.delete();
    res.sendStatus(200);
  } else {
    res.status(401).send("User not found");
  }
});

// 프로필 수정 api
app.post("/api/edit-profile", async (req, res) => {
  const { uid, email, nickname, password } = req.body;

  if (!uid || !email) {
    return res.status(400).send("Invalid request");
  }

  try {
    if (nickname) {
      const userDocRef = db.collection("users").doc(email);
      await userDocRef.update({ nickname: nickname });
    }

    if (password) {
      await admin.auth().updateUser(uid, {
        displayName: nickname,
        password: password,
      });
    }

    res.status(200).send("Profile updated successfully");
  } catch (error) {
    res.status(500).send("Failed to update profile");
  }
});

// 프로필 이미지 수정 api
app.post("/api/edit-profile-image", async (req, res) => {
  const { uid, email, imageURL } = req.body;

  if (!uid || !email) {
    return res.status(400).send("Invalid request");
  }

  // if(!imageURL){
  //   return res.status(404).send("imageURL is not exist");
  // }

  try {
    if (imageURL == null) {
      const userDocRef = db.collection("users").doc(email);
      admin
        .auth()
        .updateUser(uid, {
          photoURL: imageURL,
        })
        .then(async () => {
          await userDocRef.update({ photoURL: imageURL });
        });

      res.status(200).send("Profile updated successfully");
    } else {
      const userDocRef = db.collection("users").doc(email);
      admin
        .auth()
        .updateUser(uid, {
          photoURL: imageURL,
        })
        .then(async () => {
          await userDocRef.update({ photoURL: imageURL });
        });

      res.status(200).send("Profile updated successfully");
    }
  } catch (error) {
    res.status(500).send("Failed to update profile");
  }
});

// '강남대학교 맛집' 키워드 크롤링 api
app.get("/api/getRestaurants", async (req, res) => {
  const results = await searchBusiness();
  if (results) {
    const filteredData = results.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      type: categorizeRestaurant(item.category),
      roadAddress: item.roadAddress,
      address: item.address,
      phone: item.phone || item.virtualPhone,
      x: item.x,
      y: item.y,
      imageUrl: item.imageUrl,
      description: item.description,
      options: item.options,
      businessHours: item.businessHours,
    }));
    res.status(200).send({ results: filteredData });
  } else {
    res.status(404).json({ error: "No results found" });
  }
});

// 리뷰 작성 api
app.post("/api/create-review", async (req, res) => {
  const {
    email,
    uid,
    name,
    category,
    addressName,
    location,
    rating,
    content,
    images,
    recommend,
  } = req.body;

  if (!email || !uid) {
    res.status(400).send("Invalid request");
  }

  if (!rating || !content || !recommend) {
    res
      .status(404)
      .send("Missing required fields: rating, content, and recommendation.");
  }

  try {
    const review = {
      email,
      uid,
      name,
      category,
      addressName,
      location,
      rating,
      content,
      images,
      recommend,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    db.collection("reviews")
      .add(review)
      .then(() => {
        res.status(200).json({ message: "Review created successfully" });
      })
      .catch((err) => `try 에러: ${err}`);
  } catch (error) {
    res.status(500).send("Failed to create review");
  }
});

// 리뷰 읽기 api
app.get("/api/get-reviews", async (req, res) => {
  try {
    const reviewDocs = await db.collection("reviews").get();

    if (reviewDocs.empty) {
      return res.status(404).send("Review not found");
    }

    const reviews = [];

    for (const doc of reviewDocs.docs) {
      const reviewData = doc.data();
      const email = reviewData.email; // review에 email 필드가 있다고 가정

      // users 컬렉션에서 해당 email 유저 정보 가져오기
      const userDoc = await db.collection("users").doc(email).get();
      let userData = {};
      if (userDoc.exists) {
        userData = userDoc.data(); // nickname과 photoURL 정보를 가져옴
      }

      reviews.push({
        id: doc.id, // 리뷰 문서 ID
        nickname: userData.nickname, // 사용자 닉네임
        photoURL: userData.photoURL, // 사용자 프로필 사진
        ...reviewData, // 리뷰의 나머지 데이터
      });
    }
    res.status(200).send(reviews);
  } catch (error) {
    console.log(`Error: ${error}`);
    res.status(500).send("Failed to get reviews");
  }
});

// 내가 쓴 리뷰 읽기 api
app.get("/api/get-myreviews", async (req, res) => {
  const email = req.query.email; // 또는 req.user.email로 가져올 수 있습니다 (인증 미들웨어 사용 시)

  if (!email) {
    res.status(400).send("Invalid request");
  }

  try {
    // reviews 컬렉션에서 해당 이메일로 작성된 리뷰만 조회
    const reviewDocs = await db
      .collection("reviews")
      .where("email", "==", email)
      .get();

    if (reviewDocs.empty) {
      return res.status(404).send("No reviews found for the user");
    }

    const myUserReviews = [];
    for (const doc of reviewDocs.docs) {
      const reviewData = doc.data();

      // 해당 사용자의 추가 정보를 가져오기 위해 users 컬렉션에서 조회
      const userDoc = await db.collection("users").doc(email).get();
      let userData = {};
      if (userDoc.exists) {
        userData = userDoc.data();
      }

      myUserReviews.push({
        id: doc.id, // 리뷰 문서 ID
        nickname: userData.nickname, // 사용자 닉네임
        photoURL: userData.photoURL, // 사용자 프로필 사진
        ...reviewData, // 리뷰의 나머지 데이터
      });
    }

    res.status(200).send(myUserReviews);
  } catch (error) {
    console.error("Error getting user reviews:", error);
    res.status(500).send("Failed to get user reviews");
  }
});

// 리뷰 삭제 API
app.delete("/api/delete-review", async (req, res) => {
  const { uid } = req.body; 

  if(!uid){
    res.status(400).send("Invalid request");
  }

  try {
    const reviewQuerySnapshot = await db
      .collection("reviews")
      .where("uid", "==", uid)
      .get();

    if (reviewQuerySnapshot.empty) {
      return res.status(404).json({ message: "리뷰를 찾을 수 없습니다." });
    }

    // 문서 삭제 처리 (리뷰가 여러 개일 경우 첫 번째 문서만 삭제)
    const batch = db.batch();
    reviewQuerySnapshot.forEach(doc => {
      batch.delete(doc.ref);  // 문서 삭제
    });

    await batch.commit();  // Firestore에 일괄 삭제 요청
    return res.status(200);
  } catch (error) {
    res.status(500);
  }

});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
