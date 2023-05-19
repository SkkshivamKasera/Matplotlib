const express = require('express');
const mongoose = require('mongoose')
const Users = require('./Users')
const Notes = require('./Notes')
const { body, validationResult } = require('express-validator')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors')
const serverlessHTTP = require('serverless-http')

let success = true

JWT_SEC = "kasera"

const bodyparser = require('body-parser');

const url = "mongodb://localhost:27017/database"

mongoose.connect(url)

const fetUser = (req, res, next) => {
    const token = req.header('token')
    if (!token) { return res.status(401).send(!success,{ error: "Please authenticate using a valid token" }) }
    try {
        const data = jwt.verify(token, JWT_SEC)
        req.user = data.user
        next()
    } catch (error) { return res.status(401).send({ error: "Please authenticate using a valid token" }) }
}



const app = express();
const PORT =  process.env.PORT || 5000;
app.use(bodyparser.urlencoded({ extended: true }))
app.use(bodyparser.json())
app.use(cors())

app.get('/', (req, res) => {
    res.send("Hello")
})

app.post('/adduser', [
    body('name').isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').isLength({ min: 5 })
], async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { return res.status(404).json({success: (!success), error: errors.array() }) }
    let user = await Users.findOne({ email: req.body.email })
    try {
        if (user) { return res.json({success: (!success), error: "email is already exists." }) }
        const salt = await bcrypt.genSalt(10)
        const secpass = await bcrypt.hash(req.body.password, salt)
        user = await Users.create({
            name: req.body.name,
            email: req.body.email,
            password: secpass
        })
        const data = {
            user: {
                id: user.id
            }
        }
        const token = jwt.sign(data, JWT_SEC)
        res.json({success: success ,Authentication_Token: token })
    } catch (error) {
        console.error(error.message)
        return res.send("Interval Server Error")
    }
})

app.post('/getuser', fetUser, async (req, res) => {
    try {
        const userId = req.user.id
        const user = await Users.findById(userId).select("-password")
        res.send(success)
    } catch (error) {
        console.error(error.message)
        return res.send("Interval Server Error")
    }
})

app.post('/login', [
    body('email').isEmail(),
    body('password').isLength({ min: 5 })
], async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { return res.status(404).json({"success": (!success), error: errors.array() }) }
    const {email, password} = req.body
    try {
        let user = await Users.findOne({email})
        if (!user) { return res.status(400).json({success: (!success), error: "not found"})}
        const passCom = await bcrypt.compare(password, user.password)
        if(!passCom){ return res.status(400).json({success: (!success), error: "not found"})}
        const data = {
            user: {
                id: user.id
            }
        }
        const token = jwt.sign(data, JWT_SEC)
        res.json({success: (success), Authentication_Token: token})
    } catch (error) {
        console.error(error.message)
        return res.json({success: (!success), error:"Internal Server Error"})
    }
})

app.get('/fetchNotes', fetUser, async (req, res) => {
    const notes = await Notes.find({ user: req.user.id })
    res.json(notes)
})

app.post('/addnote', fetUser, [
    body('title').isLength({ min: 5 }),
    body('desc').isLength({ min: 10 })
], async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { return res.status(401).json({ errors: errors.array() }) }
    const { title, desc, tag } = req.body
    let note = new Notes({ user: req.user.id, title, desc, tag })
    newNote = await note.save()
    res.send(newNote)
})

app.put('/updateNote/:id', fetUser, async (req, res) => {
    const { title, desc, tag } = req.body
    const newNote = {}
    if (title) { newNote.title = title }
    if (desc) { newNote.desc = desc }
    if (tag) { newNote.tag = tag }

    let note = await Notes.findById(req.params.id)
    if (!note) { return res.status(404).send("Not Found") }

    if (note.user.toString() !== req.user.id) {
        return res.status(401).send("Not Allowed")
    }

    note = await Notes.findByIdAndUpdate(req.params.id, { $set: newNote }, { new: true })
    res.send(note)
})

app.delete('/deleteNote/:id', fetUser, async (req, res) => {
    try {
        let note = await Notes.findById(req.params.id)
        if (!note) { return res.status(404).send("Not Found") }

        if (note.user.toString() !== req.user.id) {
            return res.status(401).send("Not Allowed")
        }

        note = await Notes.findByIdAndDelete(req.params.id)
        res.send("Successfully deleted...............")
    } catch (error) {
        console.error(error.message)
        return res.send("Interval Server Error")
    }
})

app.listen(PORT, (error) => {
    if (!error)
        console.log("Server is Successfully Running, and App is listening on port " + PORT)
    else
        console.log("Error occurred, server can't start", error);
}
);