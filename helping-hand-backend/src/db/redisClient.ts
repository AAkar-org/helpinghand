import { createClient } from 'redis';
import 'dotenv/config';

const client = createClient({
    url: process.env.REDIS_URL
});

client.on('error', (err) => console.log('Redis Client Error', err));
client.on('connect', () => console.log('Connected to Redis'));


(async () => {
    await client.connect();
})();

export default client;