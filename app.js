var fs = require('fs');
const crypto = require('crypto');
const _ = require('lodash');
const request = require('request');
const async = require('async');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const commandLineArgs = require('command-line-args')
const optionDefinitions = [
  { name: 'auth', type: Boolean },
  { name: 'download', type: Boolean},
  { name: 'dest', type:String},
  { name: 'imagesize', type:String}
]

const options = commandLineArgs(optionDefinitions);
const secrets = require('./secrets');

let flickrOptions = {
      api_key: secrets.api_key,
      format: "json",
      nojsoncallback: "1"
    };

const user_id = "76445795@N03";

function auth(){
    let param = _.extend({
        method: "flickr.auth.getFrob"
    }, flickrOptions)


    function authURL(frob){
        let param = {
            perms:'read',
            frob,
            api_key: flickrOptions.api_key}

        return sign(param, true);
    }


    function token(frob){
        let param = _.extend({
            method: "flickr.auth.getToken",
            frob
        }, flickrOptions)

        return sign(param)
    }

    request.get(sign(param), (err, resp, data) => {
        let d = JSON.parse(data);
        console.log("==Please visit this URL and approve permission==\n\n");
        let frob = d.frob._content
        console.log(authURL(frob))
        console.log('\n\nPress Enter when you have done this: ');

        rl.on('line', (input) => {
            // start to get auth_token
            rl.close();
            request.get(token(frob), (err, resp, data) => {
                let token = JSON.parse(data);
                console.log(token)
                let info = {
                    auth_token: token.auth.token._content,
                    user_id: token.auth.user.nsid
                }
                fs.writeFileSync("token.json", JSON.stringify(info))
            })
        });
    })
}



function getCollections(path, size){
    let param = _.extend({
        method: "flickr.collections.getTree",
    }, flickrOptions)


    let url = sign(param);
    request.get(url, (err, resp, body) => {
        if (err) return;
        let collections = JSON.parse(body).collections.collection;
        if (!fs.existsSync(path)) fs.mkdirSync(path);

        _.each(collections, c => {
            let dir = `${path}/${c.title}`;
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
            _.each(c.set, s => {
                let setDir = `${dir}/${s.title}`;
                if (!fs.existsSync(setDir)) fs.mkdirSync(setDir);
                console.log("Set folder: "+setDir)

                // start to download photoset
                photoset(s.id, setDir, size)
            })
        })
    })
}

function photoset(photoset_id, path, size){
    let s = `url_${size}`;
    let param = _.extend({
        method: "flickr.photosets.getPhotos",
        photoset_id,
        extras: s
    }, flickrOptions)

    let dataPath = path+"/data.json";
    qSet.push({dataPath, param}, (err, list) => {
        if (err){
            console.log(err);
            return;
        }
        _.each(list.photoset.photo, p => {
            qPhoto.push({
                src: p[s],
                dest: path + '/' + _.last(p[s].split('/'))
            })
        })
    })
}

// async fetching and download with concurrency
let qSet = async.queue(function(p, callback){
    fs.access(p.dataPath, err => {
        if (err){
            // not exist
            console.log("fetching photoset metadata: " + p.dataPath);
            request.get(sign(p.param), (err, resp, body) => {
                let list = JSON.parse(body);
                fs.writeFile(p.dataPath, body);
                callback(err, list);
            })
        }
        else{
            console.log("photoset metadata already exists: " + p.dataPath);
            fs.readFile(p.dataPath, {encoding:'utf8'}, (err, data) => {
                try{
                    callback(err, JSON.parse(data));
                }
                catch(e){
                    callback(e)
                }
            })
        }
    })
}, 2)



let qPhoto = async.queue(function(task, callback){
    fs.access(task.dest, err => {
        if (err){
            let stream = request(task.src).pipe(fs.createWriteStream(task.dest));
            stream.on('finish', ()=>{
                console.log(task.src + " ==> " + task.dest);
                callback();
            })
        }
        else{
            console.log(task.dest + " already exists");
            callback();
        }
    })

}, 5);

qPhoto.drain = function(){
    console.log('all items have been processed');
}

function sign(data, isAuth){
    let str = secrets.api_secret;
    let param = [];
     _(data).keys().sortBy().each(key => {
         str += key + data[key]
         param.push(key + "=" +encodeURIComponent(data[key]))
     })

     param.push("api_sig="+crypto.createHash('md5').update(str).digest("hex"));

     let pre = 'https://api.flickr.com/services/rest/?';
     if (isAuth){
         pre = 'https://flickr.com/services/auth/?'
     }
     let url = pre+param.join('&');
    //  console.log(url)
     return url
}


function download(dest, size){
    dest = dest || "./images";
    size = size || 'o';
    if (size.length != 1 || "stmo".indexOf(size) == -1){
        console.log("wrong size of image");
        return;
    }


    let token;
    try{
        token = require('./token');
    }
    catch (e){
        console.log("Token does not exist. Please get the auth token first");
        return;
    }

    _.merge(flickrOptions, token);

    // download
    getCollections(dest, size);
}


if (options.auth){
    auth();
}
else if (options.download){
    download(options.dest, options.imagesize);
}
else{
}
