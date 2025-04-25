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

    async lockPost(postLink) {
        try {
            const postId = postLink.split('/comments/')[1]?.split('/')[0];
            if (!postId) {
                throw new Error('Invalid post link format');
            }
            const submission = await this.r.getSubmission(postId);
            await submission.lock();
            console.log(`Post locked: ${postLink}`);
        } catch (error) {
            console.error(`Failed to lock post ${postLink}:`, error);
        }
    }

    async unlockPost(postLink) {
        try {
            const postId = postLink.split('/comments/')[1]?.split('/')[0];
            if (!postId) {
                throw new Error('Invalid post link format');
            }
            const submission = await this.r.getSubmission(postId);
            await submission.unlock();
            console.log(`Post unlocked: ${postLink}`);
        } catch (error) {
            console.error(`Failed to unlock post ${postLink}:`, error);
        }
    }

    async getPostStatus(postLink) {
        try {
            const postIdMatch = postLink.match(/comments\/([a-z0-9]+)/i);
            if (!postIdMatch || postIdMatch.length < 2) {
                throw new Error('Invalid post link format. Could not extract post ID.');
            }
    
            const postId = postIdMatch[1];
            const post = await this.r.getSubmission(postId).fetch();
    
            return {
                isLocked: post.locked,
            };
        } catch (error) {
            console.error('Error fetching post status:', error);
            throw new Error('Failed to fetch post status.');
        }
    }
}