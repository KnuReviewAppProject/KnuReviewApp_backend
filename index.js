const express = require('express')
const jwt = require('jsonwebtoken')
const admin = require('firebase-admin')

const app = express()
app.use(express.json())

const serviceAccount = require('./knureviewapp-firebase-adminsdk-981au-22c73372a2.json')
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
})

// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";

// const firebaseConfig = {
//   apiKey: "AIzaSyAT8JtX4FMVOY37U9Bo12H5X7WNPLyfGjU",
//   authDomain: "knureviewapp.firebaseapp.com",
//   projectId: "knureviewapp",
//   storageBucket: "knureviewapp.appspot.com",
//   messagingSenderId: "857847580323",
//   appId: "1:857847580323:web:ad13df58f9a00515b42116",
//   measurementId: "G-QHNEXJ0BVT"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

const db = admin.firestore()
const VERIFICATION_TIMEOUT = 3 * 60 * 1000 // 3분 시간 제한
const JWT_SECRET = 'jwt_secret_0b0000_1111'

app.post('/api/send-verification-code', async (req, res) => {
	const { email } = req.body

	if (!email) {
		return res.status(400).send('Invalid request')
	}

	const user = await admin.auth().getUserByEmail(email).catch(err => null)

	if (user) {
		return res.status(409).send('Email already exists')
	}

	// const token = await admin.auth().createCustomToken(email)
	const customToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' })
	const verificationCode = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
	const verificationDoc = db.collection('verifications').doc(email)
	const existingVerification = await verificationDoc.get()

	if (existingVerification.exists) {
		await verificationDoc.delete()
	}

	await verificationDoc.set({
		verificationCode,
		token: customToken,
		timestamp: admin.firestore.FieldValue.serverTimestamp()
	})

	// TODO: Email로 Verification code 전송
	console.log(`Send verification code ${verificationCode} to ${email}`)

	res.status(200).send({ token: customToken })
})

app.post('/api/verify-email', async (req, res) => {
	const { email, verificationCode: vcode, token } = req.body

	if (!email || !vcode || !token) {
		return res.status(400).send('Invalid request')
	}

	// const decodedToken = await admin.auth().verifyIdToken(jwt).catch(err => null)

	// if (!decodedToken || decodedToken.email != email) {
	// 	return res.status(401).send('Invalid token')
	// }

	// Firestore에서 이메일로 인증 코드와 JWT 조회
	const verificationPrm = db.collection('verifications').doc(email)
	const verificationDoc = await verificationPrm.get()

	if (!verificationDoc.exists) {
		return res.status(404).send('Verification code not found')
	}

	const savedData = verificationDoc.data()
	const savedVerificationCode = savedData.verificationCode
	const savedToken = savedData.token
	const timestamp = savedData.timestamp.toMillis() // Firestore의 Timestamp 객체를 밀리초로 변환

	const currentTime = Date.now()
	if (currentTime - timestamp > VERIFICATION_TIMEOUT) {
		// 인증 코드가 3분을 초과했으면 만료 처리
		await verificationDoc.ref.delete()
		return res.status(410).send('Verification code expired')
	}

	// 제출된 JWT와 Firestore에 저장된 JWT 비교
	if (token != savedToken) {
		return res.status(401).send('Invalid token')
	}

	if (vcode != savedVerificationCode) {
		return res.status(401).send('Invalid verification code')
	}

	// // 인증이 완료되면 Firestore에서 인증 데이터를 삭제
	await verificationDoc.ref.delete()

	// 새로운 JWT 생성
	// const token = await admin.auth().createCustomToken(email)

	res.status(200).send({ token })
})

// app.post('/api/register', async (req, res) => {})
app.post('/api/register', async (req, res) => {
	const {
		email,
		password,
		displayName,
		photoURL,
		phoneNumber,
		uid,
		token
	} = req.body

	// business logic
	res.status(200).send(user)
})

app.listen(3000, () => {
	console.log('Server is running on port 3000')
})