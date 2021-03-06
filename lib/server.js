const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const configs = require('../configs/service-config');
const db = require('./db/index');

const TrainService = require('./services/train-service');

const router = require('./router/router');

class Server {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketio(this.server);
        this.trainService = new TrainService();
    }

    appConfig() {
        this.app.use(cors());
        this.app.use(router);
    }

    connectDB() {
        mongoose.connect(configs.mongodb.connection, configs.mongodb.options, (err) => {
            if (err) {
                console.log(err)
            } else {
                console.log('DB Connected')
            }
        });
        mongoose.set('useCreateIndex', true);
    }

    processWebSocket() {
        this.io.on('connection', (socket) => {


            socket.on('join', async (data, callback) => {
                try {
                    const { error, train, trains } = await this.trainService.addTrain(socket.id, data.name, data.city);
                    if (error) {
                        return callback(error)
                    }
                    socket.emit('message', { train, trains, text: `${train.name} has now Joined` });
                    socket.broadcast.to(train.city).emit('message', { train: 'Admin', trains, text: `${train.name} has now ready for ${train.city} metro` })
                    socket.join(train.city)
                    callback();
                } catch (err) {

                }
            })

            socket.on('sendMessage', async (message, callback) => {
                try {
                    const { error, train } = await this.trainService.updateFeedByTrainId(message);
                    if (error) {
                        return callback(error)
                    }
                    let response = await this.trainService.getAllFeed();
                    this.io.to('chennai').emit('message', { train: 'Admin', trains: response.trains, text: `Feed has been received from ${message.name}` });
                    callback();
                } catch (err) {

                }
            });

            socket.on('disconnect', async () => {
                try {
                    const { error, train } = await this.trainService.removeFeedByTrainId(socket.id);
                    if (error) {
                        return callback(error)
                    }
                    let response = await this.trainService.getAllFeed();
                    this.io.to('chennai').emit('message', { train: 'Admin', trains: response.trains, text: `${socket.id} has now disconnected.` });

                    callback();
                } catch (err) {

                }
            })
        })
    }

    startServer() {
        this.appConfig();
        db.connect().then(()=>{
            this.server.listen(configs.port, () => {
                console.log('Server has started on Port : ', configs.port)
            });
        });
        this.processWebSocket();
    }
}

module.exports = Server;
