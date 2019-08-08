const GhostAdminAPI = require('@tryghost/admin-api');
const mysql = require('mysql');
const cheerio = require('cheerio');

const ghostHost = 'http://localhost:2368';
const adminApiKey = 'YOUR_GHOST_API_KEY';

const mySqlHost = '127.0.0.1';
const user = 'USERNAME';
const password = 'PASSWORD';
const database = 'GHOST_DB';

const api = new GhostAdminAPI({
  url: ghostHost,
  key: adminApiKey,
  version: 'v2'
});

const connection = mysql.createConnection({
  host     : mySqlHost,
  user     : user,
  password : password,
  database : database
});

const cleanup = (content) => {
  // replace line break
  content = content.replace(/(\r\n|\n|\r)/gm,'<br>');

  // remove wp shortcode
  content = content.replace(/(\[vc.*?\])|(\[\/vc.*?\])/gm, '');

  // remove <br> within ul or ol
  const $ = cheerio.load(content);
  $('ul').find('br').remove();
  $('ol').find('br').remove();
  return $('body').html()
}

const getFeatureImage = (postId) => new Promise(resolve => {
  const query = `select guid as url from wp_posts, ( select meta_value from wp_postmeta where post_id = '${postId}' and meta_key = '_thumbnail_id' ) as r where id = r.meta_value`;
  connection.query(query, (error, p, f) => {
    if (error) {
      console.log(error)
    }
    resolve(p[0].url)
  })
})

const doInsert = async (posts, index) => {
  index = index || 0;
  const html = cleanup(posts[index].post_content);
  const id = posts[index].id;

  const url = await getFeatureImage(id)
  // console.log(url);
  // connection.end();

  api.posts.add({
    title: posts[index].post_title,
    slug: posts[index].post_name,
    html: html,
    feature_image: url,
    published_at: posts[index].post_date,
    updated_at: posts[index].post_modified,
    status: 'published'
  }, {
    source: 'html'
  })
  .then(res => {
    console.log(`processing post id: ${id} ok`);
  })
  .catch(err => {
    console.log(`processing post id: ${id} error`);
    console.log(err);
  })
  .finally(() => {
    if (index + 1 < posts.length) {
      doInsert(posts, index + 1);
    } else {
      console.log('Done importing');
      connection.end();
    }
  })
}

connection.connect();
connection.query('select id, post_content, post_title, post_name, post_date, post_modified from wp_posts where post_type = \'post\' and post_status = \'publish\';', function (error, posts, fields) {
  if (error) throw error;
  doInsert(posts);
});
