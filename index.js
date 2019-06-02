const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const PORT = process.env.PORT || 5000;
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});


  express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index', { 'mapsKey' : process.env.GoogleMaps_APIKEY }))
  .get('/healthtips', (req, res) => res.render('pages/healthtips'))
  .get('/search', async (req, res) => {
    try {
      const searchfor = req.query.speciality.toLowerCase();console.log('searched for:', searchfor);
      const client = await pool.connect()
      const result = await client.query("SELECT * FROM hospitals where lower(keywords) LIKE '%" + searchfor + "%' OR lower(speciality) LIKE '%" + searchfor + "%'");
      const results = { 'results': (result) ? result.rows : null};
      res.send(results);
      //res.render('pages/db', results );
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .get('/appointment', async (req, res) => {
    try {

      var dateTime = require('node-datetime');
	  var dToday = dateTime.create();
	  var formattedToday = dToday.format('d-m-Y');
	  
	  var dTmrw = dateTime.create();
	  // 1 day in the future
	  dTmrw.offsetInDays(1);
	  var formattedTmrw = dTmrw.format('d-m-Y');

	  var dDayAfter = dateTime.create();
	  // 2 day in the future
	  dDayAfter.offsetInDays(2);
	  var formattedDayAfter = dDayAfter.format('d-m-Y');

	  //console.log('dates', formattedToday, formattedTmrw, formattedDayAfter);

      const hospitalid = req.query.hospital; console.log('hospital with id:', hospitalid);
      const client = await pool.connect()
      const hospitalName = await client.query("SELECT hospital FROM hospitals where id = " + hospitalid);
      //console.log(hospitalName);
      const appointments = await client.query("SELECT app_date, app_slot FROM appointments where app_date in ('" + formattedTmrw + "', '" + formattedDayAfter + "') AND hospitalid = " + hospitalid + ' ORDER BY app_date asc');
      const results = { 'hospitalName': (hospitalName.rows[0].hospital || 'a Hospital') , 'appointments': appointments.rows, 'datetomorrow' : formattedTmrw , 'datedayafter': formattedDayAfter, 'hospitalid' : hospitalid };
      //console.log(results);
      res.render('pages/appointment', results );
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .post('/fixappointment', async (req, res) => {
    try {
      const uuidv1 = require('uuid/v1');
      const hospitalid = req.query.hospital; console.log('hospital with id:', hospitalid);
      var insertStr = (uuidv1()) + "', " +
      	req.body.hospitalid + ", '" +
      	req.body.firstname  + "', '" +
      	req.body.lastname  + "', '" +
      	req.body.email  + "', '" +
      	req.body.phone  + "', '" +
      	req.body.app_date  + "', '" +
      	req.body.app_slot  + "'";
      	console.log('Insert String', insertStr);
      const client = await pool.connect()
      const saveResult = await client.query("INSERT INTO appointments (id, hospitalid, firstname, lastname, email, phone, app_date, app_slot) values ('" + insertStr + ")");
      const hospital = await client.query("SELECT * FROM hospitals where id = " + hospitalid);
      //console.log('hospital', hospital);


      /*Sending messags*/

      	const https = require('https');
      	var _tmpLatlong = hospital.rows[0].latlong.replace(/\s/i, '');

		const post_data = JSON.stringify({
		    'to' : req.body.phone + ',' + req.body.email, 
		    'subject' : "Appointment Booking Confirmation",
		    'body' : "Hi " + req.body.firstname + ", Your appointment at " + hospital.rows[0].hospital + " is confirmed for " + req.body.app_date + ", " + req.body.app_slot 
		    				+ ". Please contact the hospital (" + hospital.rows[0].phone + ") directly for any changes in the booking." 
		    				+ "Map: https://www.google.com/maps/search/?api=1&query=" + _tmpLatlong,
		    'email': {
		    	'body' : "Hi " + req.body.firstname + ", Your appointment at " + hospital.rows[0].hospital + " is confirmed for " + req.body.app_date + ", " + req.body.app_slot 
		    				+ ". <br/>Please contact the hospital (" + hospital.rows[0].phone + ") directly for any changes in the booking." 
		    				+ "<br/>Map: <a href=\"https://www.google.com/maps/search/?api=1&query=" + _tmpLatlong + "\">click here</a>",
		    	'type' : 'text/html'
		    }
		});

		const options = {
		  hostname: process.env.WHISPIR_INSTANCE,
		  port: 443,
		  path: '/messages',
		  method: 'POST',
		  headers: {
		    'Content-Type': 'application/vnd.whispir.message-v1+json',
		    'x-api-key': process.env.WHISPIR_APIKEY,
		    'Authorization': process.env.WHISPIR_AUTH
		  }
		}

		const reqWhispir = https.request(options, (resWhispir) => {
		  console.log(`Whispir statusCode: ${resWhispir.statusCode}`);
		});
		reqWhispir.on('error', (error) => {
		  console.error(error)
		});

		// Request is made here, with data as string or buffer
	    reqWhispir.write(post_data)
	    // Ending the request
		reqWhispir.end()

	/*end sending messages*/



      const results = { 'results': (hospital) ? hospital.rows : null, 'mapsKey' : process.env.GoogleMaps_APIKEY};
      res.render('pages/makeappointment', results );
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .get('/allappointments', async (req, res) => {
    try {
      const hospitalid = req.query.hospital; console.log('hospital with id:', hospitalid);
      const client = await pool.connect()
      const result = await client.query("SELECT * FROM appointments where id = " + hospitalid);
      const results = { 'results': (result) ? result.rows : null};
      res.render('pages/allappointments', results );
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })

  .listen(PORT, () => console.log(`Listening on ${ PORT }`))

