import express from 'express'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'

let app = express()

// fix __dirname
let __filename = fileURLToPath(import.meta.url)
let __dirname = path.dirname(__filename)

// middleware
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))


// home route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"))
})


// 🗄️ SCHEMA
let userSchema = mongoose.Schema({
    name: String,
    phone: String,
    address: String,
    farmSize: String,
    zone: String,
    role: String,
    password: String
})

// MODEL
let User = mongoose.model("users", userSchema)


// 🔌 CONNECT DATABASE (MongoDB Compass)
mongoose.connect("mongodb://127.0.0.1:27017/agricultureDB")
    .then(() => console.log("Database connected"))
    .catch(err => console.log(err))


// 📝 REGISTER
app.post("/register", async (req, res) => {

    console.log("REGISTER DATA:", req.body)   // ✅ ADD THIS LINE

    let data = req.body

    if (!data.password || data.password.length !== 5) {
        return res.send("Password must be exactly 5 characters")
    }

    // 🔴 ADMIN REGISTER
    if (data.name && data.name.toLowerCase().trim() === "admin" && data.phone === "9999999999") {

        data.role = "admin"

        // optional: clean unwanted fields
        data.farmSize = ""
        data.zone = ""
        data.address = ""

    } else {
        // 🟢 FARMER REGISTER
        if (!data.phone || !data.address || !data.farmSize || !data.zone) {
            return res.send("All farmer fields are required")
        }

        data.role = "farmer"
    }

    let existingUser = await User.findOne({ phone: data.phone })

    if (existingUser) {
        return res.send("User already registered")
    }

    await User.create(data)

    res.send("User registered successfully")
})


// 🔐 LOGIN
app.post("/login", async (req, res) => {

    let { name, phone, password, passkey } = req.body

    // 🔴 ADMIN LOGIN
    if (name && name.toLowerCase().trim() === "admin") {

        let admin = await User.findOne({ phone: phone, role: "admin" })

        if (!admin) {
            return res.json({ message: "Admin not found" })
        }

        if (admin.password !== password) {
            return res.json({ message: "Incorrect password" })
        }

        if (!passkey) {
            return res.json({ message: "Passkey required" })
        }

        if (passkey !== "5463") {
            return res.json({ message: "Invalid passkey" })
        }

        return res.json({
            message: "Admin login successful",
            role: "admin",
            name: admin.name,
            phone: admin.phone
        })
    }

    // 🟢 FARMER LOGIN
    let user = await User.findOne({ phone: phone })

    if (!user) {
        return res.json({ message: "User not found" })
    }

    if (user.password !== password) {
        return res.json({ message: "Incorrect password" })
    }

    return res.json({
        message: "Farmer login successful",
        role: "farmer",
        name: user.name,
        phone: user.phone
    })
})

// ------------------- POWER -------------------
let powerSchema = mongoose.Schema({
    phone: String,
    startTime: String,
    endTime: String
})
let Power = mongoose.model("power", powerSchema)


// ------------------- USAGE -------------------
let usageSchema = mongoose.Schema({
    phone: String,
    units: Number,
    date: String
})
let Usage = mongoose.model("usage", usageSchema)


// ------------------- VOLTAGE -------------------
let voltageSchema = mongoose.Schema({
    phone: String,
    voltage: Number,
    date: String
})
let Voltage = mongoose.model("voltage", voltageSchema)


// ------------------- COMPLAINT -------------------
let complaintSchema = mongoose.Schema({
    phone: String,
    message: String,
    reply: String
})
let Complaint = mongoose.model("complaints", complaintSchema)

// ------------------- FARMER DASHBOARD -------------------
app.post("/farmerDashboard", async (req, res) => {

    let user = await User.findOne({ phone: req.body.phone })

    if (!user) {
        return res.send("User not found")
    }

    let power = await Power.findOne({ phone: user.phone })
    let usage = await Usage.find({ phone: user.phone })
    let voltage = await Voltage.find({ phone: user.phone })
    let complaints = await Complaint.find({ phone: user.phone })

    res.send({
        name: user.name,
        zone: user.zone,
        farmSize: user.farmSize,
        power: power ? power : "No schedule available",
        usage: usage.length ? usage : "No usage data",
        voltage: voltage.length ? voltage : "No voltage data",
        complaints: complaints
    })
})

// ------------------- GET USAGE -------------------
app.post("/getUsage", async (req, res) => {

    let result = await Usage.find({ phone: req.body.phone })

    res.send(result)
})


// ------------------- GET VOLTAGE -------------------
app.post("/getVoltage", async (req, res) => {

    let result = await Voltage.find({ phone: req.body.farmerPhone })

    res.send(result)
})

// ------------------- ADD COMPLAINT -------------------
app.post("/addComplaint", async (req, res) => {

    await Complaint.create(req.body)

    res.send("Complaint submitted")
})


////////////////////////////////////// ADMIN ////////////////////////////////////

// ------------------- SET POWER -------------------
app.post("/setPower", async (req, res) => {
    if (req.body.phone !== "9999999999") {
        return res.send("Only admin allowed")
    }

    let { farmerPhone, startTime, endTime } = req.body

    if (!farmerPhone || farmerPhone.trim() === "") {
        return res.send("Farmer phone is required")
    }

    // update if already exists
    let existing = await Power.findOne({ phone: farmerPhone })

    if (existing) {
        await Power.updateOne({ phone: farmerPhone }, { $set: { startTime, endTime } })
        return res.send("Power schedule updated")
    }

    await Power.create({ phone: farmerPhone, startTime, endTime })

    res.send("Power schedule added")
})

// ------------------- ADD USAGE (ADMIN) -------------------
app.post("/addUsage", async (req, res) => {

    if (req.body.phone !== "9999999999") {
        return res.send("Only admin allowed")
    }

    await Usage.create({
        phone: req.body.farmerPhone,
        units: req.body.units,
        date: req.body.date
    })

    res.send("Usage added")
})

// ------------------- ADD VOLTAGE (ADMIN) -------------------
app.post("/addVoltage", async (req, res) => {

    if (req.body.phone !== "9999999999") {
        return res.send("Only admin allowed")
    }

    await Voltage.create({
        phone: req.body.farmerPhone,
        voltage: req.body.voltage,
        date: req.body.date
    })

    res.send("Voltage added")
})

// ------------------- GET ALL FARMERS -------------------
app.post("/getFarmers", async (req, res) => {
    if (req.body.phone !== "9999999999") {
        return res.send("Only admin allowed")
    }

    let farmers = await User.find({ role: "farmer" })

    res.send(farmers)
})

// ------------------- GET FARMER USAGE -------------------
app.post("/getFarmerUsage", async (req, res) => {

    if (req.body.phone !== "9999999999") {
        return res.send("Only admin allowed")
    }

    let { phone } = req.body

    let usage = await Usage.find({ phone })

    res.send(usage)
})

// ------------------- GET COMPLAINTS -------------------
app.post("/getComplaints", async (req, res) => {
    if (req.body.phone !== "9999999999") {
        return res.send("Only admin allowed")
    }

    let complaints = await Complaint.find()

    res.send(complaints)
})

// ------------------- REPLY TO COMPLAINT -------------------
app.post("/replyComplaint", async (req, res) => {

    if (req.body.phone !== "9999999999") {
        return res.send("Only admin allowed")
    }

    let { id, reply } = req.body

    await Complaint.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { reply: reply } }
    )

    res.send("Reply sent")
})

let announcementSchema = mongoose.Schema({
    message: String,
    date: String
})

let Announcement = mongoose.model("announcements", announcementSchema)

// ------------------- ADD ANNOUNCEMENT -------------------
app.post("/addAnnouncement", async (req, res) => {

    if (req.body.phone !== "9999999999") {
        return res.send("Only admin allowed")
    }

    await Announcement.create({
        message: req.body.message,
        date: new Date().toLocaleDateString()
    })

    res.send("Announcement added")
})

// ------------------- GET ANNOUNCEMENTS -------------------
app.get("/getAnnouncements", async (req, res) => {

    let data = await Announcement.find()

    res.send(data)
})

// ▶️ SERVER START
app.listen(3000, () => {
    console.log("Server running on port 3000")
})