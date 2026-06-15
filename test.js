const { queryVelociraptor } = require('./server/util/velociraptorUtils.js');
queryVelociraptor("SELECT * FROM source(client_id='C.d923a8377762f284', flow_id=(SELECT session_id FROM flows(client_id='C.d923a8377762f284') WHERE request.artifacts[0] =~ 'Network.Netstat' ORDER BY create_time DESC LIMIT 1).session_id, artifact='Windows.Network.Netstat') LIMIT 2")
  .then(res => console.log(JSON.stringify(res, null, 2)))
  .catch(console.error);
