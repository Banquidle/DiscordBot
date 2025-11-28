import cron from 'node-cron'
import dotenv from 'dotenv'
import { promises as fs } from 'fs'

dotenv.config()

const GUILD = '1297123181739376700'
const VOICE_CHANNEL = '1348761088556142612'
const TEXT_CHANNEL = '1297123182503002174'
const STORAGE_FILE = './daily_players.json'

const CRON = '15 10 * * *'

import {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    InviteTargetType
} from 'discord.js'

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
})

async function trackPlayer(userId) {
    try {
        let players = []
        try {
            const data = await fs.readFile(STORAGE_FILE, 'utf-8')
            players = JSON.parse(data)
        } catch (err) {
        }

        if (!players.includes(userId)) {
            players.push(userId)
            await fs.writeFile(STORAGE_FILE, JSON.stringify(players, null, 2))
            console.log(`Tracked user: ${userId}`)
        }
    } catch (error) {
        console.error('Error tracking player:', error)
    }
}

async function popDailyPlayers() {
    try {
        const data = await fs.readFile(STORAGE_FILE, 'utf-8')
        const players = JSON.parse(data)
        
        await fs.writeFile(STORAGE_FILE, JSON.stringify([]))
        
        return players
    } catch (err) {
        return []
    }
}

client.once(Events.ClientReady, (readyClient) => {
    console.log(`Bot is ready! Logged in as ${readyClient.user.tag}`)

    cron.schedule(CRON, async () => {
        console.log('Running daily task: sending Banquidle invitation !')
        
        const playerIds = await popDailyPlayers()
        
        let mentionString = ""
        if (playerIds.length > 0) {
            const pings = playerIds.map(id => `<@${id}>`).join(' ')
            mentionString = `\n\n🥸 **ping:** ${pings}`
        }
        
        sendButton(null, mentionString)
    }, {
        timezone: "Europe/Paris"
    })
})

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.member.user.bot) return

    if (newState.channelId === VOICE_CHANNEL && oldState.channelId !== VOICE_CHANNEL) {
        await trackPlayer(newState.member.id)
    }
})

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return

    if (message.content.toLowerCase().startsWith('!b'))
    {
        sendButton(message)
    }
})

async function sendButton(message = null, extraContent = "")
{
    const activityId = process.env.ACTIVITY_ID

    if (!activityId) {
        console.error("ACTIVITY_ID is not set in .env file.")
        return
    }

    const guild = await client.guilds.fetch(GUILD)
    const voiceChannel = guild.channels.cache.get(VOICE_CHANNEL)

    if (!voiceChannel) {
        console.error("Voice channel not found.")
        return
    }

    const invite = await voiceChannel.createInvite({
        targetType: InviteTargetType.EmbeddedApplication,
        targetApplication: activityId
    })

    const startButton = new ButtonBuilder()
        .setLabel('Start Banquidle')
        .setStyle(ButtonStyle.Link)
        .setURL(invite.url)

    const row = new ActionRowBuilder().addComponents(startButton)

    const toSend = {
        content: `Rejoins le **Banquidle** du jour !${extraContent}`,
        components: [row]
    }

    if (message) {
        await message.reply(toSend)
    } else {
        const channels = await guild.channels.fetch();
        const textChannel = channels.get(TEXT_CHANNEL);

        if (textChannel && textChannel.isTextBased()) {
            await textChannel.send(toSend)
        } else {
            console.error("Target Text Channel not found or is not a text channel.")
        }
    }
}

client.login(process.env.TOKEN)
