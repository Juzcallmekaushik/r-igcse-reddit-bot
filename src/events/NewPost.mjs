import { DiscordService } from '../services/discordService.mjs';
import { RedditService } from '../services/redditService.mjs';

let discordService;
const redditService = new RedditService();

const subreddit = 'igcse';
const discordChannelId = '1369535067592065034';

let lastCheckedTime = Math.floor(Date.now() / 1000);

async function fetchAndSendNewPostsImmediately() {
    try {
        if (!discordService) {
            discordService = new DiscordService(process.env.DISCORD_TOKEN, [
                '1365518941450932224',
                '1365561748341395577',
                '1365595878525636681',
                '1366048336506912768',
            ]);
        }

        const newPosts = await redditService.getNewPosts(subreddit);

        if (!newPosts || newPosts.length === 0) {
            return;
        }

        const recentPosts = newPosts.filter(post => post.created_utc > lastCheckedTime);

        if (recentPosts.length === 0) {
            return;
        }

        for (const post of recentPosts.reverse()) {
            const message = formatPostMessage(post);
            const channel = await discordService.client.channels.fetch(discordChannelId);
            if (channel && channel.isTextBased()) {
                await channel.send(message);
            } else {
                console.error(`[AutoMod] Channel ${discordChannelId} is not text-based or could not be fetched.`);
            }
        }

        lastCheckedTime = Math.max(...recentPosts.map(post => post.created_utc));
    } catch (error) {
        return;
    }
}

function formatPostMessage(post) {
    const embed = {
        title: post.title,
        url: post.url,
        description: 
        `**Author:** u/${post.author}  
        **Posted At:** <t:${Math.floor(post.created_utc)}:R>`,
        color: 0xE75318,
    };

    return {
        content: `**New Post Alert !!**`,
        embeds: [embed],
    };
}

setInterval(fetchAndSendNewPostsImmediately, 2000);

export default fetchAndSendNewPostsImmediately;