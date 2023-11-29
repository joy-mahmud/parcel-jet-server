const express = require('express')
const app = express()
const port = process.env.PORT || 5000
const cors = require('cors')
var jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

//middleware
app.use(cors())
app.use(express.json())


//middleware verify token

const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden access' })
    }

    const token = req.headers.authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'forbidden access' })
        }

        req.decoded = decoded
        next()
    })
}




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7xouwts.mongodb.net/?retryWrites=true&w=majority`;

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
        await client.connect();

        const userCollection = client.db('parcelDb').collection('users')
        // const menuCollection = client.db('bistroDb').collection('menuCollection')
        // const reviewCollection = client.db('bistroDb').collection('reviews')
        const cartCollection = client.db('parcelDb').collection('carts');
        // const paymentCollection = client.db('bistroDb').collection('payments');

        //verify admin middleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })

            }
            next()
        }
        //jwt related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })
        //users relted apis
        //get users
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            // console.log(req.headers)
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        //api for checking isAdmin
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'anuthorized acccess' })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })


        })
        //api for checking isDeliveryMan
        app.get('/users/deliveryMan/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'anuthorized acccess' })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)
            let deliveryMan = false
            if (user) {
                deliveryMan = user?.role === 'delivery_man'
            }
            res.send({ deliveryMan })


        })

        //user creation
        app.post('/users', async (req, res) => {
            const user = req.body

            //checking user exist or not
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })
        //delete user
        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })

        //api to make a user as admin 
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        //get request to find the all menu data
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray()
            res.send(result)
        });

        //add menu item api
        app.post('/menu',verifyToken,verifyAdmin, async(req,res)=>{
            const item = req.body
            const result = await menuCollection.insertOne(item)
            res.send(result)
        })
        //get a menu item
        app.get('/menu/:id',async(req,res)=>{
            const id = req.params.id
            const query = {_id: new ObjectId(id)}
            const result = await menuCollection.findOne(query)
            res.send(result)
        })

        //update menu item
        app.patch('/menu/:id', async(req,res)=>{
            const item = req.body
            const id = req.params.id
            const filter = {_id: new ObjectId(id)}
            const updatedDoc = {
                $set:{
                    name:item.name,
                    category:item.category,
                    price:item.price,
                    recipe:item.recipe,
                    image:item.image
                }
            }
            const result = await menuCollection.updateOne(filter,updatedDoc)
            res.send(result)
        })

        //delete a menu item

        app.delete('/menu/:id', verifyToken,verifyAdmin, async (req,res)=>{
            const id = req.params.id 
            const query = { _id: new ObjectId(id)}
            const result = await menuCollection.deleteOne(query)
            res.send(result)
        })


        //get for reviews data
        app.get('/reviews' , async (req, res) => {
            const result = await reviewCollection.find().toArray()
            res.send(result)
        })
        //get cart data
        app.get('/cart', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await cartCollection.find(query).toArray()
           // console.log(result)
            res.send(result)
        })
        //post method to add to cart
        app.post('/addtocart', async (req, res) => {
            const item = req.body
            const result = await cartCollection.insertOne(item)
            res.send(result)
        })
        //delete requsest to delete from cart
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })
        //payment related api 
        app.post('/payments', async(req,res)=>{
            const payment = req.body
            const paymentResult  = await paymentCollection.insertOne(payment)
            
            const query = {_id:{
                $in: payment.cartIds.map(id=> new ObjectId(id))
            }}
            const deleteResult = await cartCollection.deleteMany(query)
            res.send({paymentResult,deleteResult})
        })
        //payment history
        app.get('/paymentHistory/:email',verifyToken,async (req,res)=>{
            const email = req.params.email
            const query = {email:email}
            if(email!==req.decoded.email){
                return res.status(403).send({message:'forbidden access'})
            }
            const result = await paymentCollection.find(query).toArray()
            res.send(result)
        })
        //admin stats
        app.get('/admin-stats',verifyToken,verifyAdmin,async(req,res)=>{
            const users = await userCollection.estimatedDocumentCount()
            const menuItems = await menuCollection.estimatedDocumentCount()
            const orders = await paymentCollection.estimatedDocumentCount()
            const result = await paymentCollection.aggregate([
                {
                    $group:{
                       _id:null,
                       totalRevenue:{
                        $sum:'$price'
                       }
                    }
                }
            ]).toArray()
            const revenue = result.length>0?result[0].totalRevenue:0
            
            res.send({users,menuItems,orders,revenue})
        })
        //stripe payment intent api
        app.post('/create-payment-intent', async(req,res)=>{
            const {price}=req.body
            const amount = parseInt(price*100)
            console.log(amount)
            const paymentIntent = await stripe.paymentIntents.create({
                amount:amount,
                currency: "usd",
                payment_method_types: ['card']
                   
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('parcel manager is running')
})

app.listen(port, () => {
    console.log(`parcel management server is running on port ${port}`)
})