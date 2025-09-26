/**
 * Utility functions for handling Discord message limitations
 */

/**
 * Splits a long message into chunks that fit Discord's 2000 character limit
 * @param {string} message - The message to split
 * @param {string} wrapperPrefix - Text to add before each chunk (e.g., "```")
 * @param {string} wrapperSuffix - Text to add after each chunk (e.g., "```")
 * @param {number} bufferSize - Extra buffer to account for formatting (default: 10)
 * @returns {string[]} Array of message chunks
 */
export function chunkMessage(message, wrapperPrefix = '', wrapperSuffix = '', bufferSize = 10) {
    const maxChunkSize = 2000 - wrapperPrefix.length - wrapperSuffix.length - bufferSize;
    
    if (message.length <= maxChunkSize) {
        return [message];
    }

    const chunks = [];
    let currentChunk = '';
    
    // Split by lines to avoid breaking in the middle of important formatting
    const lines = message.split('\n');
    
    for (const line of lines) {
        // If adding this line would exceed the limit, save current chunk and start new one
        if (currentChunk.length + line.length + 1 > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = line;
        } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
        }
    }
    
    // Add the last chunk if it exists
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
}

/**
 * Sends a potentially long message in chunks to a Discord channel
 * @param {Object} channel - Discord channel object
 * @param {string} message - The message to send
 * @param {Object} options - Options for formatting
 * @param {string} options.title - Title prefix for each chunk
 * @param {string} options.wrapperPrefix - Text to wrap before content (e.g., "```")
 * @param {string} options.wrapperSuffix - Text to wrap after content (e.g., "```")
 * @param {boolean} options.addPartNumbers - Whether to add part numbers for multiple chunks
 */
export async function sendChunkedMessage(channel, message, options = {}) {
    const {
        title = '',
        wrapperPrefix = '',
        wrapperSuffix = '',
        addPartNumbers = true
    } = options;

    const chunks = chunkMessage(message, wrapperPrefix, wrapperSuffix);
    
    for (let i = 0; i < chunks.length; i++) {
        const partSuffix = chunks.length > 1 && addPartNumbers ? ` (Part ${i + 1}/${chunks.length})` : '';
        const fullTitle = title + partSuffix;
        
        const content = fullTitle + wrapperPrefix + chunks[i] + wrapperSuffix;
        
        await channel.send({ content });
    }
}

/**
 * Sends a potentially long message in chunks as a reply to an interaction
 * @param {Object} interaction - Discord interaction object
 * @param {string} message - The message to send
 * @param {Object} options - Options for formatting
 * @param {string} options.title - Title prefix for each chunk
 * @param {string} options.wrapperPrefix - Text to wrap before content (e.g., "```")
 * @param {string} options.wrapperSuffix - Text to wrap after content (e.g., "```")
 * @param {boolean} options.addPartNumbers - Whether to add part numbers for multiple chunks
 * @param {boolean} options.ephemeral - Whether the reply should be ephemeral
 */
export async function sendChunkedInteractionReply(interaction, message, options = {}) {
    const {
        title = '',
        wrapperPrefix = '',
        wrapperSuffix = '',
        addPartNumbers = true,
        ephemeral = false
    } = options;

    const chunks = chunkMessage(message, wrapperPrefix, wrapperSuffix);
    
    for (let i = 0; i < chunks.length; i++) {
        const partSuffix = chunks.length > 1 && addPartNumbers ? ` (Part ${i + 1}/${chunks.length})` : '';
        const fullTitle = title + partSuffix;
        
        const content = fullTitle + wrapperPrefix + chunks[i] + wrapperSuffix;
        
        if (i === 0) {
            // First chunk as reply
            await interaction.editReply({ 
                content,
                flags: ephemeral ? 64 : 0
            });
        } else {
            // Additional chunks as followup messages
            await interaction.followUp({ 
                content,
                flags: ephemeral ? 64 : 0
            });
        }
    }
}