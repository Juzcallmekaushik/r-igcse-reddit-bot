import { RedditService } from '../src/services/redditService.mjs';
import { DiscordService } from '../src/services/discordService.mjs';
import { insertData, deleteData, updateData, fetchData } from '../src/services/mongoService.mjs';
import dotenv from 'dotenv';

dotenv.config();


const logChannelIds = ['1365518941450932224', '1365561748341395577', '1365595878525636681', '1366048336506912768'];
const redditService = new RedditService();
const discordService = new DiscordService(process.env.DISCORD_TOKEN, logChannelIds);
const mongoService = { insertData, deleteData, updateData, fetchData };

redditService.initialize();
