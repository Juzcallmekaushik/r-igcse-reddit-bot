import { RedditService } from '../services/redditService.mjs';

const redditService = new RedditService();

const subreddit = 'igcse';
let lastCheckedTime = Math.floor(Date.now() / 1000);

async function sendWelcomeMessage(post) {
    try {
        const reply = await redditService.createPostReply(
            `https://www.reddit.com${post.url}`,
            `**Thanks for posting on r/IGCSE!**\n\n` +
            `Please ensure that your post follows our community rules.\n\n` +
            `---\n\n` +
            `**Important Rules:**\n` +
            `- **No Cheating**: We do not support cheating. Requests for leaks, answers, or trying to access papers before they have been sat are strictly prohibited. More details [here](https://www.reddit.com/r/igcse/wiki/rules)\n` +
            `- **No Locked Paper Requests**: Requesting or sharing locked exam papers (e.g., Feb/March 2025 papers before the official release) is considered piracy. These papers are only publicly available after the official results date. Violations may lead to warnings or bans.\n` +
            `- **No Unapproved Advertisements**: Do not promote external projects or services without prior moderator approval. More details [here](https://www.reddit.com/r/igcse/wiki/rules)\n\n` +
            `---\n\n` +
            `Violating any of these guidelines may lead to a **temporary or permanent ban.**\n\n` +
            `**Helpful Links:**\n` +
            `- **Join our Discord server for study discussions and support** [here](https://discord.gg/IGCSE)\n` +
            `- **Explore our Resource Repository** [here](https://r-igcse.study/)\n\n` +
            `*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](https://www.reddit.com/message/compose/?to=/r/igcse) if you have any questions or concerns.*`
        );
        await redditService.r.getComment(reply.id).distinguish({ sticky: true });
    } catch (error) {
        console.error(`[AutoMod] Failed to send or sticky welcome message to post: ${post.title}`, error.message);
    }
}

export async function monitorSubreddit() {
    try {
        const newPosts = await redditService.getNewPosts(subreddit);

        if (!newPosts || newPosts.length === 0) {
            return;
        }

        const recentPosts = newPosts.filter(post => post.created_utc > lastCheckedTime);

        if (recentPosts.length === 0) {
            return;
        }

        for (const post of recentPosts) {
            await sendWelcomeMessage(post);
        }

        lastCheckedTime = Math.max(...recentPosts.map(post => post.created_utc));
    } catch (error) {
        console.error('[AutoMod] Error monitoring subreddit:', error.message);
    }
}

setInterval(monitorSubreddit, 2000);