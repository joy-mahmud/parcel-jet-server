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
        //await client.connect();

        const userCollection = client.db('parcelDb').collection('users')
        const deliveredCollection = client.db('parcelDb').collection('delivered')
        const reviewCollection = client.db('parcelDb').collection('reviews')
        const cartCollection = client.db('parcelDb').collection('carts');
        const supportCollection = client.db('parcelDb').collection('getSupport');
        const paymentCollection = client.db('parcelDb').collection('payments');

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
        //verify dekiveryman middleware
        const verifyDeliveryMan = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'delivery_man'
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
        // //api for getting user info
        // app.get('users/profile/',async(req,res)=>{
        //     const email = req.query.email
        //     const query = {email:email}
        //     const result = userCollection.findOne(query)
        //     res.send(result)
        // })

        // app.patch('users/profile/',async(req,res)=>{
        //     const email = req.query.email
        //     const query = {email:email}
        //     const updatedDoc ={
        //         $set:{

        //         }
        //     }
        //     const result = userCollection.findOne(query)
        //     res.send(result)
        // })
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
        //api for checking order status
        app.get('/cart/status/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            // if (email !== req.decoded.email) {
            //     return res.status(403).send({ message: 'anuthorized acccess' })
            // }
            const query = { _id: new ObjectId(id) }
            const item = await cartCollection.findOne(query)
            const status = item.status
            res.send({ status })
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

        //api to make a user as admin or delivery man
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const role = req.body
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: role.role
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })



        //add menu item api
        // app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
        //     const item = req.body
        //     const result = await menuCollection.insertOne(item)
        //     res.send(result)
        // })
        //get a parcel item
        app.get('/cart/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.findOne(query)
            res.send(result)
        })

        //get delivery list for a delivery man
        app.get('/deliveryList/:id', verifyToken, verifyDeliveryMan, async (req, res) => {
            const id = req.params.id
            const query = { delivery_man: id }
            const result = await cartCollection.find(query).toArray()
            res.send(result)
        })

        //update parcel item for user
        app.patch('/cart/:id', async (req, res) => {
            const item = req.body
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: item.name,
                    email: item.email,
                    phone: item.phone,
                    parcel_type: item.parcel_type,
                    weight: item.weight,
                    receiver_name: item.receiver_name,
                    receiver_phone: item.receiver_phone,
                    receiver_address: item.receiver_address,
                    latitude: item.latitude,
                    longitude: item.longitude,
                    req_date: item.req_date,
                    price: item.price,
                    status: item.status
                }
            }
            const result = await cartCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        //assign delivery man
        app.patch('/assignDeliveryMan/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const item = req.body
            console.log(item)
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: item.status,
                    approximate_date: item.approximate_date,
                    delivery_man: item.delivery_man
                }
            }
            const result = await cartCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        //get date for a range
        // app.post('/getDate',async(req,res)=>{
        //     const startDate = new Date (req.body.startDate)
        //     const endDate = new Date (req.body.endDate)
        //     console.log(startDate,endDate) 
        //     const result = await cartCollection.find({
        //         req_date:{
        //             $gte:startDate,
        //             $lte:endDate
        //         }
        //     }).toArray()
        //     res.send(result)
        // })


        //change status of an order

        app.patch('/order/status/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const item = req.body
            // console.log(item)
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: item.status
                }
            }
            const result = await cartCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })


        //for reviews data
        app.get('/getTotalReviews', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.query.email
            const filter = { email: email }
            const result = await reviewCollection.find(filter).toArray()
            res.send(result)
        })
        app.post('/giveReview', async (req, res) => {
            const review = req.body
            const result = await reviewCollection.insertOne(review)
            res.send(result)
        })
        app.get('/getReviews/:id', verifyToken, verifyDeliveryMan, async (req, res) => {
            const id = req.params.id
            const query = { deliveryManId: id }
            const result = await reviewCollection.find(query).toArray()
            res.send(result)
        })


        //get cart data for a user 
        app.get('/cart', verifyToken, async (req, res) => {
            const email = req.query.email
            const show = req.query.show

            const query = { email: email }
            const result = await cartCollection.find(query).toArray()
            if (show === 'showAll') {

                res.send(result)
            }
            else {
                const parcels = result.filter(item => {
                    return item.status === show
                })
                res.send(parcels)
            }
            // console.log(result)

        })
        // get all the orders for admin only
        app.get('/orders', verifyToken, verifyAdmin, async (req, res) => {
            const result = await cartCollection.find().toArray()
            res.send(result)

        })
        //get all the deliverymens
        app.get('/getDeliveryMen', verifyToken, verifyAdmin, async (req, res) => {
            const query = { role: 'delivery_man' }
            const result = await userCollection.find(query).toArray()
            res.send(result)
        })

        //get a specific deliveryman
        app.get('/deliveryman', verifyToken, verifyDeliveryMan, async (req, res) => {
            const email = req.query.email
            const filter = { email: email }
            const result = await userCollection.findOne(filter)
            res.send(result)
        })
        //getAll deliverymen
        app.get('/getAllDeliverymen', verifyToken, verifyAdmin, async (req, res) => {
            const query = { role: 'delivery_man' }
            const alldeliverymen = await userCollection.find(query).toArray()
            const alldeliveries = await deliveredCollection.find().toArray()
            const allReviews = await reviewCollection.find().toArray()
            const deliveryCount = alldeliverymen.map((user) => {
                const matchedUser = alldeliveries.filter(item => {
                    if (item.email === user.email) { return item }
                })
                return matchedUser.length
            })
            const totalReviewCount = alldeliverymen.map(user => {
                const matchedUser = allReviews.filter(review => {
                    if (user._id == review.deliveryManId) {
                        return review.rating
                    }
                })
                return matchedUser.length
            })
            const averageReview = deliveryCount.map((item, idx) => {
                if (item === 0) {
                    return 0
                }
                const avgFloat = totalReviewCount[idx] / item
                const avgCount = avgFloat.toFixed(2)
                return avgCount * 100
            })
            const AverageRatingCount = alldeliverymen.map(user => {
                const usersRating = allReviews.filter(review => {
                    if (user._id == review.deliveryManId) {
                        return review.rating
                    }
                })
                const totalrating = usersRating.reduce((total, item) => {
                    const totalRate = total + item.rating
                    return totalRate
                }, 0)
                if (usersRating.length === 0) {
                    return 0
                }
                const avgRating = totalrating / usersRating.length
                return avgRating.toFixed(2)

            })

            res.send({ alldeliverymen, deliveryCount, averageReview, AverageRatingCount })
        })
        //top delivery man api
        app.get('/topDeliveryMan', async (req, res) => {
            const query = { role: 'delivery_man' }
            const alldeliverymen = await userCollection.find(query).toArray()
            const alldeliveries = await deliveredCollection.find().toArray()
            const allReviews = await reviewCollection.find().toArray()
            const deliveryCount = alldeliverymen.map((user) => {
                const matchedUser = alldeliveries.filter(item => {
                    if (item.email === user.email) { return item }
                })
                return matchedUser.length
            })
            // const delivermanIdArray = alldeliverymen.map(item=>item._id)
            const length = deliveryCount.length;

            for (let i = 0; i < length - 1; i++) {
                for (let j = 0; j < length - i - 1; j++) {
                    if (deliveryCount[j] < deliveryCount[j + 1]) {

                        const temp1 = deliveryCount[j];
                        deliveryCount[j] = deliveryCount[j + 1];
                        deliveryCount[j + 1] = temp1;
                        const temp2 = alldeliverymen[j]
                        alldeliverymen[j] = alldeliverymen[j + 1];
                        alldeliverymen[j + 1] = temp2;
                    }
                }
            }
            const AverageRatingCount = alldeliverymen.map(user => {
                const usersRating = allReviews.filter(review => {
                    if (user._id == review.deliveryManId) {
                        return review.rating
                    }
                })
                const totalrating = usersRating.reduce((total, item) => {
                    const totalRate = total + item.rating
                    return totalRate
                }, 0)
                if (usersRating.length === 0) {
                    return 0
                }
                const avgRating = totalrating / usersRating.length
                return avgRating.toFixed(2)

            })
            const topDeliveryMen = alldeliverymen.slice(0, 5)
            const topDeliverycount = deliveryCount.slice(0, 5)
            const topAveragRating = AverageRatingCount.slice(0, 5)
            res.send({ topDeliveryMen, topDeliverycount, topAveragRating })
        })
        //for pagination total users page
        app.get('/usersCount', async (req, res) => {
            const count = await userCollection.estimatedDocumentCount()
            res.send({ count })
        })

        //getAll users
        app.get('/allusers', verifyToken, verifyAdmin, async (req, res) => {
            const page = parseInt(req.query.page)
            const size = parseInt(req.query.size)
            const query = { role: 'user' }
            const allUsers = await userCollection.find(query).skip(page * size).limit(size).toArray()
            const allOrderedUsers = await cartCollection.find().toArray()
            const deliveryCount = allUsers.map((user) => {
                const matchedUser = allOrderedUsers.filter(item => {
                    if (item.email === user.email) { return item }
                })
                return matchedUser.length
            })
            res.send({ allUsers, deliveryCount })
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

        //delivery related api 
        app.post('/delivered', async (req, res) => {
            const item = req.body
            const result = await deliveredCollection.insertOne(item)
            res.send(result)
        })
        //for top delivery man



        //home stats
        app.get('/homeStats', async (req, res) => {
            const users = await userCollection.estimatedDocumentCount()
            const totalDelivery = await deliveredCollection.estimatedDocumentCount()
            const totalBooking = await cartCollection.estimatedDocumentCount()

            res.send({ users, totalBooking, totalDelivery })
        })
        //support related apis
        app.post('/getSupport', async (req, res) => {
            const supportData = req.body
            const result = await supportCollection.insertOne(supportData)
            res.send(result)
        })
        app.get('/getUsermsg', verifyToken, verifyAdmin, async (req, res) => {
            const query = { status: 'pending' }
            const result = await supportCollection.find(query).toArray()
            res.send(result)
        })
        app.patch('/provideSupport/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const replyBody = req.body
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: replyBody.status,
                    reply: replyBody.reply
                }
            }
            const result = await supportCollection.updateOne(query, updatedDoc)
            res.send(result)
        })
        app.get('/getReply', verifyToken, async (req, res) => {
            const email = req.query.email
            const query = { email: email, status: 'replied' }
            const result = await supportCollection.find(query).toArray()
            res.send(result)
        })
        //subscription related api
        app.get('/isNewUser', verifyToken, async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const userCreationDate = new Date(user.signUpDate)
            console.log(userCreationDate)
            const currentDate = new Date()
            const differenceInMilliseconds = Math.abs(currentDate - userCreationDate)
            const millisecondsInADay = 1000 * 60 * 60 * 24
            const differenceInDays = Math.floor(differenceInMilliseconds / millisecondsInADay);
            let newUser = false;
            if (differenceInDays <= 10) {
                newUser = true;
            }
            console.log(newUser)
            res.send({ isNewUser: newUser })
        })
        //cart api
        app.get('/cart/due/:email', async(req,res)=>{
            const email = req.params.email
          const query = {email:email,pay_status:'due'}
          const result = await cartCollection.find(query).toArray()
          res.send(result)
        })
        //admin stats

        //payment related api 
        app.post('/payments', async (req, res) => {
            const payment = req.body
            const paymentResult = await paymentCollection.insertOne(payment)

            // const query = {
            //     _id: {
            //         $in: payment.cartIds.map(id => new ObjectId(id))
            //     }
            // }
            // const deleteResult = await cartCollection.deleteMany(query)
            res.send({ paymentResult })
        })
        //payment history
        app.get('/paymentHistory/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const result = await paymentCollection.find(query).toArray()
            res.send(result)
        })
        //stripe payment intent api
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body
            const amount = parseInt(price * 100)
            // console.log(amount)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']

            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })
        app.patch('/cart/paid/:email',verifyToken,async(req,res)=>{
            const email = req.params.email
            const paymentInfo = req.body
            const cartiIds = paymentInfo.cartIds
            const objectIds = cartiIds.map(id=>new ObjectId(id))
            console.log(objectIds)
            const query = {_id:{
                $in:objectIds
            }}
            const updatedDoc = {
                $set:{pay_status:paymentInfo.pay_status}
            }
            const result =await cartCollection.updateMany(query,updatedDoc)
            res.send(result)

        })
        // //test code
        // const currentDate = new Date('2023-11-30');
        // const reqDate = new Date('2023-12-05')
        // const currentDay = currentDate.getDate();
        // const currentMonth=currentDate.getMonth()+1
        // const currentYear = currentDate.getFullYear();
        // const appro = currentDate.setDate(currentDay + 3);
        // const approximate_date = currentDate.getDate()

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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