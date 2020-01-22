const moment = require('moment');
const utils = require('../module/utils');
const fs = require('fs');
const {Op} = require('sequelize');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
const os = require('os-utils');


function Site(router, sequelizeObjects) {


  /**
   * Get intelligence
   */
  router.post('/get/intelligence', function (req, res) {

    // Day selection from web interface, default today
    const selectedDate = req.body.selectedDate;

    const performance = {
      loadAvg: String(os.loadavg(5) + '%'),
      memUse: String(100 - Math.floor(os.freemem() / os.totalmem() * 100)) + '%'
    };

    // Data is array of { h: '2006', a: 100 }, objects
    let activityData = {'data': [], 'xkey': 'h', 'ykeys': ['a'], 'labels': ['Activity']};
    let donutData = [];

    sequelizeObjects.Data.findAll({
      attributes: [
        'label',
        'file_name',
        'file_create_date',
        'detection_result',
        'file_name_cropped',
      ],
      where: {
        createdAt: {
          [Op.gt]: moment(selectedDate).startOf('day').utc(true).toISOString(true),
          [Op.lt]: moment(selectedDate).endOf('day').utc(true).toISOString(true),
        }
      },
      order: [
        ['createdAt', 'asc']
      ]
    }).then(rows => {
      if (rows.length > 0) {

        // Create activity chart data
        for (let i = 0; i < 24; i++) {
          const activityHourStr = utils.AddLeadingZeros(String(i), 2);
          const activity = rows.filter(function (row) {
            let momentHour = moment(row.file_create_date).utc(true).format('HH');
            return momentHour === activityHourStr
          }).length;
          activityData.data.push({h: activityHourStr, a: activity});
        }

        // Parse label counts
        donutData = utils.GetLabelCounts(rows);
      }

      // Return results
      res.json({
        performance: performance,
        activity: activityData,
        donut: donutData,
      });
    }).catch(error => {
      res.status(500);
      res.send(error);
    })
  });


  /**
   * Get weekly intelligence
   */
  router.get('/get/weekly/intelligence', function (req, res) {
    let activityDataWeek = {'data': [], 'xkey': 'h', 'ykeys': ['a'], 'labels': ['Activity']};
    const startDay = moment().startOf('day').subtract(7, 'days').utc(true);
    sequelizeObjects.Data.findAll({
      attributes: [
        'file_create_date'
      ],
      where: {
        createdAt: {
          [Op.gt]: startDay.toISOString(true),
          [Op.lt]: moment().startOf('day').utc(true).toISOString(true),
        }
      },
      order: [
        ['createdAt', 'asc']
      ]
    }).then(rows => {
      if (rows.length > 0) {
        // Create week activity chart data
        for (let d = 0; d < 7; d++) {
          const parseDay = moment(startDay).add(d, 'days').format('DD');
          // console.log('parse day: ' + parseDay);
          for (let h = 0; h < 24; h++) {
            const activityHourStr = utils.AddLeadingZeros(String(h), 2);
            const dayActivityHour = parseDay + '-' + activityHourStr;
            const activity = rows.filter(function (row) {
              let momentDay = moment(row.file_create_date).utc(true).format('DD');
              let momentHour = moment(row.file_create_date).utc(true).format('HH');
              return momentDay === parseDay && momentHour === activityHourStr
            }).length;
            activityDataWeek.data.push({h: dayActivityHour, a: activity});
          }
        }
      }

      // Return results
      res.json({
        activityWeek: activityDataWeek,
      });
    });
  });


  /**
   * Return latest detected object detection image
   * Folder: /output/object_detection/
   * base64 image data output
   */
  router.get('/get/latest/object/detection/image', function (req, res) {
    const filePath = path.join(__dirname + '../../../' + 'output/object_detection/');
    fs.readdir(filePath, function (err, files) {
      if (err) {
        res.status(500);
        res.send(err);
      }
      let objectDetectionFile = utils.GetNewestFile(files, filePath);
      if (files !== undefined) {
        if (files.length > 0) {
          fs.readFile(filePath + objectDetectionFile, function (err, data) {
            if (err) {
              res.status(500);
              res.send(err);
            } else {
              res.json({
                'data': 'data:image/png;base64,' + Buffer.from(data).toString('base64')
              });
            }
          });
        } else {
          res.status(500);
          res.send('No files available');
        }
      }
    });
  });


  /**
   * Get label images from output /label folder
   * label specified at post body
   */
  router.post('/get/label/images', function (req, res) {
    // Day selection from web interface, default today
    const selectedDate = req.body.selectedDate;

    let outputData = {images: []};
    const label = req.body.label;
    const filePath = path.join(__dirname + '../../../' + 'output/' + label + '/');

    fs.readdir(filePath, function (err, files) {
      if (err) {
        res.status(500);
        res.send(err);
      } else {
        let filesList = utils.GetFilesNotOlderThan(files, filePath, selectedDate);

        // Read file data
        // noinspection JSIgnoredPromiseFromCall
        processImagesSequentially(filesList.length);

        async function processImagesSequentially(taskLength) {

          // Specify tasks
          const promiseTasks = [];
          for (let i = 0; i < taskLength; i++) {
            promiseTasks.push(processImage);
          }

          // Execute tasks
          let t = 0;
          for (const task of promiseTasks) {
            console.log('Loading: ' + filesList[t].file);
            outputData.images.push(await task(filesList[t].file, filesList[t].mtime));
            t++;
            if (t === taskLength) {
              res.json(outputData); // All tasks completed, return
            }
          }
        }

        function processImage(file, mtime) {
          return new Promise(resolve => {
            fs.readFile(filePath + file, function (err, data) {
              if (!err) {
                const datetime = moment(mtime).format(process.env.DATE_TIME_FORMAT);
                resolve({
                  title: datetime,
                  file: file,
                  image: 'data:image/png;base64,' + Buffer.from(data).toString('base64')
                });
              } else {
                console.log(err);
                resolve('data:image/png;base64,');
              }
            });
          });
        }

      }
    });
  });


  /**
   * Loads sr image
   */
  router.post('/get/super/resolution/image', function (req, res) {
    const label = req.body.label;
    const image_file_name = req.body.imageFile;
    const filePath = path.join(__dirname + '../../../' + 'output/' + label + '/super_resolution/');
    fs.readFile(filePath + image_file_name, function (err, data) {
      if (err) {
        res.status(500);
        res.send(err);
      } else {
        res.json({
          'data': 'data:image/png;base64,' + Buffer.from(data).toString('base64')
        });
      }
    });
  });


  /**
   * Get voice intelligence
   */
  router.get('/get/voice/intelligence', function (req, res) {
    let output = {message: ''};

    sequelizeObjects.Data.findAll({
      attributes: [
        'label', 'file_create_date', 'name', 'detection_result',
      ],
      where: {
        voice_completed: 0,
        createdAt: {
          [Op.gt]: moment().startOf('day').utc(true).toISOString(true),
          [Op.lt]: moment().endOf('day').utc(true).toISOString(true),
        }
      },
      order: [
        ['createdAt', 'asc']
      ]
    }).then(rows => {
      if (rows.length > 0) {

        // Too much data
        if (rows.length > 10) {
          output.message += 'I have seen ';
        }

        // Labels
        let labelCounts = utils.GetLabelCounts(rows);
        labelCounts.forEach(labelObj => {
          const count = labelObj.value;
          output.message += String(labelObj.value) + ' ' + labelObj.label + (count > 1 ? 's' : '') + ', '
        });

        // Detection results
        const detection_results_count = rows.filter(function (row) {
          return row.detection_result !== ''
        }).length;
        output.message += (detection_results_count > 0 ? '' + String(detection_results_count) + ' new detection results.'
          : '') + ' ';

        // Latest object detection image recorded
        const latestRow = rows[rows.length - 1];
        output.message += '' + latestRow.label + ' seen at '
          + moment(latestRow.file_create_date).utc(true).format('HH:mm') + '. ';

        // Interesting license plates
        // TODO: Needs feature to value plate into groups of known and unknown to determine what is interesting
        // output.message += 'No interesting license plates.';


        // Mark detections as talked over voice to not say them again
        sequelizeObjects.Data.update(
          {
            voice_completed: 1
          },
          {
            where: {
              voice_completed: 0,
              createdAt: {
                [Op.gt]: moment().startOf('day').utc(true).toISOString(true),
                [Op.lt]: moment().endOf('day').utc(true).toISOString(true),
              }
            }
          }).then(() => {
          res.json(output);
        }).catch(() => {
          res.json(output);
        });
      } else {
        res.json(output);
      }
    });

  });


  /**
   * Get license plate detection results
   */
  router.post('/get/license/plate/detections', function (req, res) {
    // Day selection from web interface, default today
    const selectedDate = req.body.selectedDate;
    sequelizeObjects.Data.findAll({
      attributes: [
        'label',
        'file_name',
        'file_create_date',
        'detection_result',
        'file_name_cropped',
      ],
      where: {
        createdAt: {
          [Op.gt]: moment(selectedDate).startOf('day').utc(true).toISOString(true),
          [Op.lt]: moment(selectedDate).endOf('day').utc(true).toISOString(true),
        },
        detection_result: {
          [Op.gt]: '',
        },
        [Op.or]: [
          {label: 'car'}, {label: 'truck'}
        ],
      },
      order: [
        ['createdAt', 'asc']
      ]
    }).then(rows => {
      if (rows.length > 0) {
        let licensePlates = [];
        const filePath = path.join(__dirname + '../../../' + 'output/');
        // noinspection JSIgnoredPromiseFromCall
        processImagesSequentially(rows.length);

        async function processImagesSequentially(taskLength) {
          // Specify tasks
          const promiseTasks = [];
          for (let i = 0; i < taskLength; i++) {
            promiseTasks.push(processImage);
          }
          // Execute tasks
          let t = 0;
          for (const task of promiseTasks) {
            licensePlates.push(
              await task(
                rows[t].file_name_cropped,
                rows[t].label,
                rows[t].file_create_date,
                rows[t].detection_result
              )
            );
            t++;
            if (t === taskLength) {
              // Return results
              res.json({
                licensePlates: licensePlates,
              });
            }
          }
        }

        function processImage(file, label, file_create_date, detection_result) {
          return new Promise(resolve_ => {
            fs.readFile(filePath + label + '/' + file, function (err, data) {
              if (!err) {
                const datetime = moment(file_create_date).format(process.env.DATE_TIME_FORMAT);
                resolve_({
                  title: datetime,
                  file: file,
                  detectionResult: detection_result,
                  image: 'data:image/png;base64,' + Buffer.from(data).toString('base64')
                });
              } else {
                console.log(err);
                resolve_({
                  title: '',
                  file: file,
                  detectionResult: detection_result,
                  image: 'data:image/png;base64'
                });
              }
            });
          });
        }
      } else {
        res.status(500);
        res.send('No license plates found');
      }
    });
  });


  /**
   * Get faces
   */
  router.post('/get/faces', function (req, res) {
    // Day selection from web interface, default today
    const selectedDate = req.body.selectedDate;
    sequelizeObjects.Data.findAll({
      attributes: [
        'label',
        'file_name',
        'file_create_date',
        'detection_result',
        'file_name_cropped',
      ],
      where: {
        createdAt: {
          [Op.gt]: moment(selectedDate).startOf('day').utc(true).toISOString(true),
          [Op.lt]: moment(selectedDate).endOf('day').utc(true).toISOString(true),
        },
        detection_result: {
          [Op.gt]: '',
        },
        label: 'person',
      },
      order: [
        ['createdAt', 'asc']
      ]
    }).then(rows => {
      if (rows.length > 0) {
        let faces = [];
        const filePath = path.join(__dirname + '../../../' + 'output/');
        // noinspection JSIgnoredPromiseFromCall
        processImagesSequentially(rows.length);

        async function processImagesSequentially(taskLength) {
          // Specify tasks
          const promiseTasks = [];
          for (let i = 0; i < taskLength; i++) {
            promiseTasks.push(processImage);
          }
          // Execute tasks
          let t = 0;
          for (const task of promiseTasks) {
            faces.push(
              await task(
                rows[t].file_name_cropped,
                rows[t].label,
                rows[t].file_create_date,
                rows[t].detection_result
              )
            );
            t++;
            if (t === taskLength) {
              // Return results
              res.json({
                faces: faces,
              });
            }
          }
        }

        function processImage(file, label, file_create_date, detection_result) {
          return new Promise(resolve_ => {
            fs.readFile(filePath + label + '/' + file, function (err, data) {
              if (!err) {
                const datetime = moment(file_create_date).format(process.env.DATE_TIME_FORMAT);
                resolve_({
                  title: datetime,
                  file: file,
                  detectionResult: detection_result,
                  image: 'data:image/png;base64,' + Buffer.from(data).toString('base64')
                });
              } else {
                console.log(err);
                resolve_({
                  title: '',
                  file: file,
                  detectionResult: detection_result,
                  image: 'data:image/png;base64'
                });
              }
            });
          });
        }
      } else {
        res.status(500);
        res.send('No faces found');
      }
    });
  });


}

exports.Site = Site;
