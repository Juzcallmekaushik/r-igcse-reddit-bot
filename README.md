# Reddit Discord Bot

This project is a Discord bot that interacts with the Reddit API using the snoowrap library. The bot allows users to execute various commands that fetch and submit content on Reddit directly from Discord.

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd reddit-discord-bot
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Create a Reddit application:**
   - Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps).
   - Click on "Create App" or "Create Another App".
   - Fill in the required fields:
     - **name**: Your bot's name
     - **App type**: Script
     - **description**: (optional)
     - **about url**: (optional)
     - **permissions**: (optional)
     - **redirect uri**: `http://localhost:8080` (or any valid URL)
   - After creating the app, you will receive:
     - **client ID**: The string under "webapp" or "script" (not the secret)
     - **client secret**: The secret key for your application
     - **username**: Your Reddit username
     - **password**: Your Reddit password

4. **Configure your bot:**
   - Create a `.env` file in the root directory and add your Reddit credentials:
     ```
     REDDIT_CLIENT_ID=your_client_id
     REDDIT_CLIENT_SECRET=your_client_secret
     REDDIT_USERNAME=your_username
     REDDIT_PASSWORD=your_password
     DISCORD_TOKEN=your_discord_bot_token
     ```

5. **Run the bot:**
   ```
   npm start
   ```

## Usage Examples

- Use commands in Discord to interact with Reddit, such as fetching posts from a subreddit or submitting new content.

## Contributing

Feel free to submit issues or pull requests for improvements and new features!
