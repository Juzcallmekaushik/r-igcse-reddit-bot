import snoowrap from 'snoowrap';
import dotenv from 'dotenv';

dotenv.config();

export class RedditService {
    constructor() {
        this.r = new snoowrap({
            userAgent: process.env.REDDIT_USER_AGENT,
            clientId: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET,
            username: process.env.REDDIT_USERNAME,
            password: process.env.REDDIT_PASSWORD,
        });
    }

    async initialize() {
        try {
            const me = await this.r.getMe();
            console.log(`[-] Logged in as Reddit user: ${me.name}`);
        } catch (error) {
            console.error('Failed to initialize RedditService:', error);
        }
    }

    async getPost(postLink) {
        try {
            const postIdMatch = postLink.match(/comments\/([a-z0-9]+)/i);
            if (!postIdMatch || postIdMatch.length < 2) {
                throw new Error('Invalid post link format. Could not extract post ID.');
            }

            const postId = postIdMatch[1];
            const post = await this.r.getSubmission(postId).fetch();

            if (post.subreddit.display_name.toLowerCase() !== 'igcse') {
                throw new Error('The post does not belong to the r/igcse subreddit.');
            }

            return post;
        } catch (error) {
            console.error('Error fetching post:', error.message);
            throw new Error('Failed to fetch post. Please ensure the link is valid and belongs to r/igcse.');
        }
    }

    async getPostTitle(postLink) {
        try {
            const post = await this.getPost(postLink);
            return post.title;
        } catch (error) {
            console.error('Error fetching post title:', error);
            throw new Error('Failed to fetch post title.');
        }
    }

    async lockPost(postLink) {
        try {
            const post = await this.getPost(postLink);
            await post.lock();
            console.log(`Post locked: ${postLink}`);
        } catch (error) {
            console.error(`Failed to lock post ${postLink}:`, error);
        }
    }

    async unlockPost(postLink) {
        try {
            const post = await this.getPost(postLink);
            await post.unlock();
            console.log(`Post unlocked: ${postLink}`);
        } catch (error) {
            console.error(`Failed to unlock post ${postLink}:`, error);
        }
    }

    async getPostStatus(postLink) {
        try {
            const post = await this.getPost(postLink);
            return {
                isLocked: post.locked,
            };
        } catch (error) {
            console.error('Error fetching post status:', error);
            throw new Error('Failed to fetch post status.');
        }
    }

    async getNewPosts(subreddit) {
        try {
            const posts = await this.r.getSubreddit(subreddit).getNew({ limit: 10 });
            return posts.map(post => ({
                id: post.id,
                title: post.title,
                url: `https://www.reddit.com${post.permalink}`,
                author: post.author.name,
                created_utc: post.created_utc,
            }));
        } catch (error) {
            console.error(`[RedditService] Error fetching new posts from r/${subreddit}:`, error.message);
            throw new Error(`Failed to fetch new posts from r/${subreddit}.`);
        }
    }

async submitSelfpost({ title, body, flairid }) {
    try {
        if (!title || !body) {
            throw new Error('Post title or text is missing.');
        }

        const post = await this.r.getSubreddit('igcse').submitSelfpost({
            title: title,
            text: body,
            flairId: flairid,
        });

        return post.name;
    } catch (error) {
        console.error(`[RedditService] Error submitting selfpost to r/igcse:`, error.message);
        throw new Error(`Failed to submit selfpost to r/igcse.`);
    }
}

    async searchPostsById({ id }) {
        try {

            if (!id) {
                throw new Error('Post ID is missing.');
            }

            const post = await this.r.getSubmission(id).fetch();

            if (post.subreddit.display_name.toLowerCase() !== 'igcse') {
                throw new Error('The post does not belong to the r/igcse subreddit.');
            }

            return {
                id: post.id,
                title: post.title,
                url: `https://www.reddit.com${post.permalink}`,
                author: post.author.name,
                created_utc: post.created_utc,
                body: post.selftext,
            };
        } catch (error) {
            console.error(`[RedditService] Error searching post by ID in r/igcse:`, error.message);
            throw new Error(`Failed to search post by ID in r/igcse.`);
        }
    }
}