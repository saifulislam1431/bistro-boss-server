const express = require("express")
require("dotenv").config();
const cors = require("cors")
const port = process.env.PORT || 5000;
const app = express()



app.use(cors())
app.use(express.json())






app.get("/",(req,res)=>{
    res.send("Bistro Boss Restaurant server")
})

app.listen(port,()=>{
    console.log(`This server listening at port ${port}`);
})