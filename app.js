/*
 *  This file is part of SYZOJ.
 *
 *  Copyright (c) 2016 Menci <huanghaorui301@gmail.com>
 *
 *  SYZOJ is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  SYZOJ is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public
 *  License along with SYZOJ. If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

let fs = require('fs'),
    path = require('path');

global.syzoj = {
  config: require('./config.json'),
  models: [],
  modules: [],
  db: null,
  log(obj) {
    console.log(obj);
  },
  run() {
    let Express = require('express');
    global.app = Express();

    syzoj.production = app.get('env') === 'production';

    app.listen(parseInt(syzoj.config.port), syzoj.config.hostname, () => {
      this.log(`SYZOJ is listening on ${syzoj.config.hostname}:${parseInt(syzoj.config.port)}...`);
    });

    // Set assets dir
    app.use(Express.static(__dirname + '/static'));

    // Set template engine ejs
    app.set('view engine', 'ejs');

    // Use body parser
    let bodyParser = require('body-parser');
    app.use(bodyParser.urlencoded({
      extended: true,
      limit: '50mb'
    }));
    app.use(bodyParser.json({ limit: '50mb' }));

    // Use cookie parser
    app.use(require('cookie-parser')());

    let multer = require('multer');
    app.multer = multer({ dest: syzoj.utils.resolvePath(syzoj.config.upload_dir, 'tmp') });

    this.connectDatabase();
    this.loadHooks();
    this.loadModules();
  },
  connectDatabase() {
    let Sequelize = require('sequelize');
    this.db = new Sequelize(this.config.db.database, this.config.db.username, this.config.db.password, {
      host: this.config.db.host,
      dialect: this.config.db.dialect,
      storage: this.config.db.storage ? this.utils.resolvePath(this.config.db.storage) : null,
      logging: syzoj.production ? false : syzoj.log
    });
    global.Promise = Sequelize.Promise;
    this.db.sync();
  },
  loadModules() {
    fs.readdir('./modules/', (err, files) => {
      if (err) {
        this.log(err);
        return;
      }
      files.filter((file) => file.endsWith('.js'))
           .forEach((file) => this.modules.push(require(`./modules/${file}`)));
    });
  },
  model(name) {
    if (this.models[name] !== undefined) return this.models[name];
    else return this.models[name] = require(`./models/${name}`);
  },
  loadHooks() {
    let Session = require('express-session');
    let FileStore = require('session-file-store')(Session);
    let sessionConfig = {
      secret: this.config.session_secret,
      cookie: {},
      rolling: true,
      saveUninitialized: true,
      resave: true,
      store: new FileStore
    };
    if (syzoj.production) {
      app.set('trust proxy', 1);
      sessionConfig.cookie.secure = true;
    }
    app.use(Session(sessionConfig));

    app.use((req, res, next) => {
      // req.session.user_id = 1;
      if (req.session.user_id) {
        let User = syzoj.model('user');
        User.fromID(req.session.user_id).then((user) => {
          res.locals.user = user;
          next();
        }).catch((err) => {
          this.log(err);
          res.locals.user = req.session.user_id = null;
          next();
        })
      } else {
        res.locals.user = req.session.user_id = null;
        next();
      }
    });

    // Active item on navigator bar
    app.use((req, res, next) => {
      res.locals.active = req.path.split('/')[1];
      next();
    });

    app.use((req, res, next) => {
      res.locals.req = req;
      res.locals.res = res;
      next();
    });
  },
  utils: require('./utility')
};

syzoj.run();
