const Discord = require("discord.js");
const { prefix, token } = require('./config.json');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg');
const client = new Discord.Client();
const http = require('http');
const PORT = process.env.PORT || 5000;

// http.createServer().listen(PORT);

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('Hello World!');
  res.end();
}).listen(PORT);

const serverList = new Map();

client.once('ready', () => {
    console.log('Ready!');
});

client.on('message', message => {
    console.log('"' + message.content + '"' + ": sent by " + message.author.username);

    //if (message.content.startsWith(`${prefix}kick`)) {
    if (message.content.startsWith(`${process.env.PREFIX}kick`)) {
        let member = message.mentions.members.first();
        member.kick().then((member) => {
            message.channel.send(":wave: " + member.displayName + " has been kicked"); //sends an emoji
        })
    }
})

//reading messages
client.on('message', async message => {
    if (message.author.bot) return; //ignore if message is from the bot
    if (!message.content.startsWith(process.env.PREFIX)) return; //ignore if message doesn't contain prefix

    const serverQueue = serverList.get(message.guild.id);

    // if (message.content.startsWith(`${prefix}play`)) {
    if (message.content.startsWith(`${process.env.PREFIX}play`)) {
        execute(message, serverQueue);
        return;
    // } else if (message.content.startsWith(`${prefix}skip`)) {
    } else if (message.content.startsWith(`${process.env.PREFIX}skip`)) {
        skip(message, serverQueue);
        return;
    // } else if (message.content.startsWith(`${prefix}stop`)) {
    } else if (message.content.startsWith(`${process.env.PREFIX}stop`)) {
        stop(message, serverQueue);
        return;
    } else {
        message.channel.send("You need to enter a valid command!");
    }
})

async function execute(message, serverQueue) {
    const args = message.content.split(" ");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "You need to be in a voice channel to play music!"
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "I need the permissions to join and speak in your voice channel!"
        );
    }

    //get song info - title and url
    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.title,
        url: songInfo.video_url
    };

    //create queue for the server if it doesn't exist yet
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };
        serverList.set(message.guild.id, queueConstruct);
        queueConstruct.songs.push(song);
        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(message.guild, queueConstruct.songs[0]);
        } catch (err) {
            console.log(err);
            serverList.delete(message.guild.id);
            return message.channel.send(err);
        }
    }

    //add song to the queue
    else {
        serverQueue.songs.push(song);
        return message.channel.send(`${song.title} has been added to the queue!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue)
        return message.channel.send("No more songs left in the queue!");
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
    const serverQueue = serverList.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        serverList.delete(guild.id); //delete the server queue if there are no more songs left
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Now playing: **${song.title}**`);
}

//client.login(token);
client.login(process.env.BOT_TOKEN);