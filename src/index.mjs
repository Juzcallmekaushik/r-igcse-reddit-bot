import { RedditService } from './services/redditService.mjs';
import { DiscordService } from './services/discordService.mjs';
import dotenv from 'dotenv';

dotenv.config();

const redditService = new RedditService();
const discordService = new DiscordService(process.env.DISCORD_TOKEN);

redditService.initialize();