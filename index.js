const express = require("express")
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require("cors")
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_TOKEN)
const app = express()

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8cnv71c.mongodb.net/?retryWrites=true&w=majority`;
app.use(cors())
app.use(express.json())

const jwtVerify = (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log(authorization);
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorized access" })
  }
  const token = authorization.split(' ')[1]
  // console.log(token);
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "Unauthorized access" })
    }
    req.decoded = decoded
    next()
  })
}




// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const menuCollection = client.db("bistroBoss").collection("menu");
    const cartCollection = client.db("bistroBoss").collection("cart");
    const usersCollection = client.db("bistroBoss").collection("users");
    const paymentCollection = client.db("bistroBoss").collection("payment");

    // JWT
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
      res.send({ token })
    })



    // Verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const result = await usersCollection.findOne(query)
      if (result?.role !== "admin") {
        return res.status(403).send({ error: true, message: "Forbidden access" })
      }
      next()
    }



    // Get Users
    app.get("/users", jwtVerify, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })



    // User operation
    app.post("/users", async (req, res) => {
      const body = req.body;
      const query = { email: body.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User exist" })
      }
      const result = await usersCollection.insertOne(body);
      res.send(result)
    })



    // Admin Check
    app.get("/users/admin/:email", jwtVerify, async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      if (req.decoded.email !== email) {
        return res.send({ admin: false })
      }
      const user = await usersCollection.findOne(query);


      const result = { admin: user?.role === "admin" }
      res.send(result)
    })

    // Create admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const userUpdate = {
        $set: {
          role: "admin"
        }
      };
      const result = await usersCollection.updateOne(filter, userUpdate);
      res.send(result)
    })




    // Get Menu
    app.get("/allMenus", async (req, res) => {
      const result = await menuCollection.find().toArray()
      res.send(result)
    })




    // Get user cart
    app.get("/carts", jwtVerify, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([])
      }
      const decodedEmail = req.decoded.email
      if (email !== decodedEmail) {
        res.status(403).send({ error: true, message: "Forbidden access" })
      }
      const query = { email: email }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })

    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(query)
      res.send(result)
    })




    // Cart Operation
    app.post("/carts", async (req, res) => {
      const body = req.body;
      const result = await cartCollection.insertOne(body)
      res.send(result)
    })

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query)
      res.send(result);
    })

    app.post("/create-payment-intent", jwtVerify, async (req, res) => {
      const { price } = req.body;
      // console.log(price)
      // const total = JSON.parse(price)
      const amount = price * 100

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: [
          "card"
        ],

      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })

    // Save Payment info

    app.post("/payment", jwtVerify, async (req, res) => {
      const body = req.body;
      const result = await paymentCollection.insertOne(body);
      
      const query = { _id: { $in: body.CartItems.map(id => new ObjectId(id)) } }

      const deletedRes = await cartCollection.deleteMany(query)
      res.send({ result, deletedRes })
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Server successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get("/", (req, res) => {
  res.send("Bistro Boss Restaurant server")
})

app.listen(port, () => {
  console.log(`This server listening at port ${port}`);
})