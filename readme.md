#Purpose
I found it is difficult to download all Flickr photos, even with the node-flickrapi SDK. It is just too complicated.
So I decided to write a single-purpose app to download everything.

#Usage:
You must have your app secrets and api_key specified in `secrets.json`. See `secrets_sample.json`.

- node app.js --auth: to authenticate and save your auth_token and user_id

- node app.js --download: to download, you can specify `--dest` for download destination, default is `./images`;
or `--imagesize`, default is "o"

#Future dev
May connect to other services such as AWS S3/Glacier, or Google photos
