export class LogService {
  constructor(client, logChannelIds) {
    if (!Array.isArray(logChannelIds) || logChannelIds.length === 0) {
      throw new Error('LogService: logChannelIds must be a non-empty array of valid channel IDs.');
    }

    this.client = client;
    this.logChannelIds = logChannelIds;
  }

  async logErrorToChannel(error, context = 'General') {
    for (const channelId of this.logChannelIds) {
      try {
        const channel = await this.client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          console.error(`LogService: Channel ${channelId} is not text-based or could not be fetched.`);
          continue;
        }

        // Ensure embed field values don't exceed Discord limits
        const errorMessage = error.message || 'No message provided';
        const truncatedMessage = errorMessage.length > 1000 ? errorMessage.slice(0, 997) + '...' : errorMessage;
        
        const stackTrace = error.stack || 'No stacktrace available';
        const truncatedStack = stackTrace.length > 1000 ? stackTrace.slice(0, 997) + '...' : stackTrace;

        const embed = {
          title: `An Exception Occurred - ${context}`,
          fields: [
            { name: 'Message', value: truncatedMessage, inline: false },
            {
              name: 'Stacktrace',
              value: `\`\`\`js\n${truncatedStack}\n\`\`\``,
              inline: false,
            },
          ],
          color: 0xff0000,
          timestamp: new Date().toISOString(),
        };

        await channel.send({ embeds: [embed] });
      } catch (err) {
        console.error(`LogService: Failed to log error to channel ${channelId}:`, err.message);
      }
    }
  }
}
