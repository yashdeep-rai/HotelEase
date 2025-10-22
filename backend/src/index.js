const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const roomsRouter = require('./routes/rooms');
const reservationsRouter = require('./routes/reservations');
const customersRouter = require('./routes/customers');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/api/rooms', roomsRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/customers', customersRouter);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`HotelEase backend listening on port ${port}`);
});
