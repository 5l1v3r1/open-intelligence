const moment = require('moment');
const utils = require('../module/utils');
const fs = require('fs');
const {Op} = require('sequelize');
const path = require('path');
const dotEnv = require('dotenv');
dotEnv.config();
const os = require('os-utils');
const Sequelize = require('sequelize');


async function Audio(router, sequelizeObjects) {


  router.post('/audio/get/for/label', async (req, res) => {
    const image_file_create_date = moment(req.body.imageFileCreateDate).format(process.env.DATE_TIME_FORMAT);
    const audioPath = path.join(__dirname + '../../../' + 'output/audio/');
    const file_extension = '.mp3';
    const audioFiles = [];

    const rows = await sequelizeObjects.sequelize.query(
      "SELECT file_name FROM recordings WHERE '" + image_file_create_date + "' between start_time and end_time"
      , {
        type: sequelizeObjects.sequelize.QueryTypes.SELECT
      }
    );
    if (rows.length > 0) {

      processAudioFilesSequentially(rows.length);

      async function processAudioFilesSequentially(taskLength) {
        // Specify tasks
        const promiseTasks = [];
        for (let i = 0; i < taskLength; i++) {
          promiseTasks.push(processAudio);
        }
        // Execute tasks
        let t = 0;
        for (const task of promiseTasks) {
          audioFiles.push(
            await task(
              rows[t].file_name
            )
          );
          t++;
          if (t === taskLength) {
            res.json(audioFiles);
          }
        }
      }

      function processAudio(file_name) {
        return new Promise(resolve_ => {

          console.log(audioPath + file_name + file_extension);

          fs.readFile(
            audioPath + file_name + file_extension, function (err, data) {
              if (!err) {
                resolve_(Buffer.from(data).toString('base64'));
              } else {
                resolve_(null);
              }
            });
        });
      }

    } else {
      res.status(200);
      res.send('No audio.');
    }

  });


  router.post('/audio/get/latest', async (req, res) => {

  });


}


exports.Audio = Audio;
