import { RedditService } from './services/redditService.mjs';
import { DiscordService } from './services/discordService.mjs';
import { insertData, deleteData, updateData, fetchData } from './services/mongoService.mjs';
import dotenv from 'dotenv';

dotenv.config();

const redditService = new RedditService();
const discordService = new DiscordService(process.env.DISCORD_TOKEN);
const mongoService = { insertData, deleteData, updateData, fetchData };

redditService.initialize();