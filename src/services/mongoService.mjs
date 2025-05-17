import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
let client;
let isConnected = false;

async function connectToDatabase() {
    if (!client) {
        client = new MongoClient(uri);
    }
    if (!isConnected) {
        await client.connect();
        isConnected = true;
        console.log('Connected to MongoDB');
    }
    return client.db('r-igcse-bot');
}

export async function insertData(collectionName, data) {
    try {
        const database = await connectToDatabase();
        const collection = database.collection(collectionName);
        const result = await collection.insertOne(data);
        return result;
    } catch (error) {
        console.error('Error inserting data:', error);
    }
}

export async function deleteData(collectionName, filter) {
    try {
        const database = await connectToDatabase();
        const collection = database.collection(collectionName);
        const result = await collection.deleteOne(filter);
        return result;
    } catch (error) {
        console.error('Error deleting data:', error);
    }
}

export async function updateData(collectionName, filter, update) {
    try {
        const database = await connectToDatabase();
        const collection = database.collection(collectionName);
        const result = await collection.updateOne(filter, update);
        return result;
    } catch (error) {
        console.error('Error updating data:', error);
    }
}

export async function fetchData(collectionName, query = {}) {
    try {
        const database = await connectToDatabase();
        const collection = database.collection(collectionName);
        const data = await collection.find(query).toArray();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    }
}

export async function closeDatabaseConnection() {
    if (client && isConnected) {
        await client.close();
        isConnected = false;
        console.log('MongoDB connection closed');
    }
}
