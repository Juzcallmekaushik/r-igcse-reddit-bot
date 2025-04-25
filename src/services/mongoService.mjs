import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export async function insertData(collectionName, data) {
    try {
        await client.connect();
        const database = client.db('reddit-bot');
        const collection = database.collection(collectionName);

        const result = await collection.insertOne(data);
    } catch (error) {
        console.error('Error inserting data:', error);
    } finally {
        await client.close();
    }
}
export async function deleteData(collectionName, filter) {
    try {
        await client.connect();
        const database = client.db('reddit-bot');
        const collection = database.collection(collectionName);

        const result = await collection.deleteOne(filter);
    } catch (error) {
        console.error('Error deleting data:', error);
    } finally {
        await client.close();
    }
}

export async function updateData(collectionName, filter, update) {
    try {
        await client.connect();
        const database = client.db('reddit-bot');
        const collection = database.collection(collectionName);
        const result = await collection.updateOne(filter, update);
    } catch (error) {
    } finally {
        await client.close();
    }
}

export async function fetchData(collectionName, query = {}) {
    try {
        await client.connect();
        const database = client.db('reddit-bot');
        const collection = database.collection(collectionName);

        const data = await collection.find(query).toArray();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    } finally {
        await client.close();
    }
}