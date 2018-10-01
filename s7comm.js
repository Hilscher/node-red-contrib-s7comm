/**
 * Copyright (c) 2017 Hilscher Gesellschaft fuer Systemautomation mbH
 * See LICENSE
 * $Id:  $:
 * Description:
 * A Node-RED node to communicate with Siemens S7 PLCs
 */

// System library
const util = require('util');

// 3rd-party library
const Nodes7 = require('nodes7');
require('colors');

let NetKeepAlive = null;
try {
  // Because net-keepalive depends on the OS
  NetKeepAlive = require('net-keepalive');
} catch (er) {
  console.log('' + timestamp().format_NodeRed + ' - ' +'[s7comm-Error] - Installation of Module net-keepalive failed because we might be on the wrong OS. OS=' + process.platform);
  NetKeepAlive = null;
}


// Configuration Management

const logLevelNodeS7Default = { debug: 0, silent: true };
const logLevelNodeREDDefault = { debug: 1, silent: true };
let logLevelNodeS7 = { debug: -1, silent: true };
let logLevelNodeRED = { debug: -1, silent: true };
// Logging nodes7 logLevelNodeS7Default => debug: -1=nothing,  0=error,  1=error+warning+info
// Logging node logLevelNodeREDDefault => debug:-1=nothing, 0=error, 1=error+warning, 2=error+warning+info, 3=error+warning+info+function

let config = null;
try {
  config = require('./config.json');
} catch (er) {
  console.log('' + timestamp().format_NodeRed + ' - ' +'[s7comm-Error] - Error during parsing of config.json. Set Default values.',);
  // set default values
  logLevelNodeS7 = logLevelNodeS7Default;
  logLevelNodeRED = logLevelNodeREDDefault;
}

function setConfiguration() {
  // Parse config.json
  if (config) {
    // Set logLevelNodeS7
    if (config.logLevelNodeS7 !== undefined
      && config.logLevelNodeS7.debug !== undefined
      && config.logLevelNodeS7.silent !== undefined
      && typeof (config.logLevelNodeS7.debug) === 'number'
      && typeof (config.logLevelNodeS7.silent) === 'boolean'
    ) {
      logLevelNodeS7.debug = config.logLevelNodeS7.debug;
      logLevelNodeS7.silent = config.logLevelNodeS7.silent;
    } else {
      console.log('' + timestamp().format_NodeRed + ' - ' +'[s7comm-Error] - Error during parsing of config.json. Set default values for logLevelNodeS7.');
      logLevelNodeS7 = logLevelNodeS7Default;
    }

    // Set logLevelNodeRED
    if (config.logLevelNodeRED !== undefined
      && config.logLevelNodeRED.debug !== undefined
      && config.logLevelNodeRED.silent !== undefined
      && typeof (config.logLevelNodeRED.debug) === 'number'
      && typeof (config.logLevelNodeRED.silent) === 'boolean'
    ) {
      logLevelNodeRED.debug = config.logLevelNodeRED.debug;
      logLevelNodeRED.silent = config.logLevelNodeRED.silent;
    } else {
      console.log('' + timestamp().format_NodeRed + ' - ' +'[s7comm-Error] - Error during parsing of config.json. Set default values for logLevelNodeRED.');
      logLevelNodeRED = logLevelNodeREDDefault;
    }
  }
  console.log('' + timestamp().format_NodeRed + ' - ' +'[s7comm-Info] - Debug configuration for logLevelNodeS7:' + JSON.stringify(logLevelNodeS7));
  console.log('' + timestamp().format_NodeRed + ' - ' +'[s7comm-Info] - Debug configuration for logLevelNodeRED:' + JSON.stringify(logLevelNodeRED));
}
// set Configuration once Node-RED parses the file
setConfiguration();


// helper functions
/**
 * @description This function returns the time as an object in three different formats
 * @returns {} time as object with parameters:
 * @returns {} obj.timeObject - Javascript Date Object
 * @returns String obj.year - year-month-date, hours:minutes:sec:ms
 * @returns String obj.time - hours:minutes:sec:ms
 */
function timestamp() {
  const myDate = new Date();
  let month = myDate.getMonth() + 1;

  switch (month) {
    case 1: month = 'Jan'; break;
    case 2: month = 'Feb'; break;
    case 3: month = 'Mar'; break;
    case 4: month = 'Apr'; break;
    case 5: month = 'May'; break;
    case 6: month = 'Jun'; break;
    case 7: month = 'Jul'; break;
    case 8: month = 'Aug'; break;
    case 9: month = 'Sep'; break;
    case 10: month = 'Oct'; break;
    case 11: month = 'Nov'; break;
    case 12: month = 'Dec'; break;
    default: month = 'Jan'; break;
  }
  return {
    format_Object: myDate,
    format_year: myDate.getFullYear() + '-' + (myDate.getMonth() + 1) + '-' + myDate.getDate() + ', ' + myDate.getHours() + ':' + myDate.getMinutes() + ':' + myDate.getSeconds() + ':' + myDate.getMilliseconds(),
    format_time: myDate.getHours() + ':' + myDate.getMinutes() + ':' + myDate.getSeconds() + ':' + myDate.getMilliseconds(),
    format_NodeRed: myDate.getDate() + ' ' + month + ' ' + myDate.getHours() + ':' + myDate.getMinutes() + ':' + myDate.getSeconds(),
  };
}

/**
 * @description
 * Checks if the given value is an numeric value or a string representing a numeric value
 * @param {anyVal} n - A value that has to be tested
 * @returns {bool} true in case of a numeric value else false
 * console.log(isNumeric(true)) //false
 * console.log(isNumeric(1))     //true
 * console.log(isNumeric(1.01))  //true
 * console.log(isNumeric(1e10))  //true
 * console.log(isNumeric('1'))   //true
 * console.log(isNumeric('1.4')) //true
 * console.log(isNumeric('1e5')) //true
 * console.log(isNumeric('a'))   //false
 * console.log(isNumeric('1a'))  //false
 */
function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * @description
 * Checks if the given value is an float value
 * @param {anyVal} n - A value that has to be tested
 * @returns {bool} true in case of a float value else false
 * console.log(isFloat(1.01))  //true
 *  console.log(isFloat(-1.01)) //true
 *  console.log(isFloat(1))     //false
 *  console.log(isFloat(1e10))  //false
 *  console.log(isFloat('1.4')) //false
 *  console.log(isFloat('-1.4'))//false
 *  console.log(isFloat('1e5')) //false
 *  console.log(isFloat('a'))   //false
 *  console.log(isFloat('1a'))  //false
 *  console.log(isFloat(true))  //false
 */
function isFloat(value) {
  if (typeof value === 'number') {
    return (value % 1 !== 0);
  }
  return false;
}

/**
 * @description An output function with a defined debug/logging-level
 * @param {} txt- log text
 * @param {} debugLevel -1=show nothing;0=show error;1=show error+warning;2=show error+warning+info
 * @param {} id -
 * @requires util
 * @requires {Object} logLevelObject that defines silentmode and level
 * @example:
 * var util=require('util')
 * //debug:(Number),-1=show nothing,0=show error,1=show error+warning,2=show error+warning+info;  silent:(bool),true=don't show logs, false=show logs

 * //within the src-code
 * outputLog('always_shown');
 * outputLog('[node-Error]- message',0);
 * outputLog('[s7comm-Warning]- message',1);
 * outputLog('[node-Info]- message',2);
 */
function outputLog(txt, debugLevel, id) {
  let idtext = '';
  const time = timestamp().format_NodeRed;
  // var time=process.hrtime();

  if (logLevelNodeRED.silent === true) {
    return;
  }

  if (typeof (id) === 'undefined') {
    idtext = '';
  } else {
    idtext = ' ' + id;
  }

  if (typeof (debugLevel) === 'undefined' || logLevelNodeRED.debug >= debugLevel) {
    if (debugLevel === 0) {
      console.log('' + time + idtext + ' - ' + util.format(txt).red.bold);
    } else {
      console.log('' + time + idtext + ' - ' + util.format(txt).green.bold);
    }
  }
}

/**
 * @description Creates an array with the length 'len' and fill it with 'val'
 * @param	{Number} - Length of the return Array
 * @param	{String|Number|Object|Array|bool|etc} - Value of each digit
 * @returns	{Array} Array with the length 'len' and fill it with 'val'
 * @example
 * FilledArray(3,'0');  //returns ['0','0','0']
 */
function FilledArray(len, val) {
  const array = [];
  for (let i = 0; i < len; i++) {
    array[i] = val;
  }
  return array;
}

function customStringify(v) {
  const cache = new Map();
  return JSON.stringify(v, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        // Circular reference found, discard key
        return;
      }
      // Store value in our map
      cache.set(value, true);
    }
    return value;
  });
}

/**
 * @description This function returns the minimum of an Array
 * @param {Array} - Array of numbers only
 * @returns {Number} - Minimum Value of the input Array
 * @examples
 * Array.min([1,2,3,4])
 * //returns 1
 */
Array.min = function (array) {
  return Math.min.apply(Math, array);
}


/**
 * @summary The actual Node-RED node consisting of read, write and config node.
 */
module.exports = (RED) => {
  function S7Configuration(n) {
    RED.nodes.createNode(this, n);

    outputLog('[s7comm-Warning] - Start a new Configuration: ' + n.id, 1);
    // Configuration options passed by Node Red
    this.id = n.id;
    this.RFCParam = {
      port: n.port,
      host: n.ip,
      rack: n.rack,
      slot: n.slot,
    };
    this.payload = n.payload;

    // Local options
    const node = this;
    node.users = {}; // a list of all nodes wich are using these Configuration
    node.plc = null; // handle for nodes7 instance
    node.status = {
      rwCyclError: false, // Patch. Flag can be removed when connectionError is fixed
      connected: null,
      connecting: null,
      reading: null,
      writing: null,
      keepAliveRunning: false,
      handleConnectionTimeout: null,
      handleStateInterval: null,
      handleLocalTimeout: null,
      readingInterval: null, // Handle for reading interval
      stateIntervalHandle: null,
      numOfReadNodes: 0,
      numOfReadIntervallNodes: 0,
      readCyclArray: [],
      readIntervalTime: 0,
      numOfWriteNodes: 0,
    };
    node.readQueue = [];
    node.writeQueue = [];
    node.readJSON = {};// a Buffer for reading JSON
    node.writeJSON = {};// a Buffer for writing JSON
    node.readDataBuffer = { // Buffer for nodes7 response
      anythingBad: null,
      values: null,
    };
    node.readJSON = {};// a Buffer for reading JSON
    node.writeJSON = {};// a Buffer for writing JSON

    // Private methods (usage only within config node)
    // helper
    function printStatus() {
      const cli = {
        address: null,
        bufferSize: null,
        bytesRead: null,
        bytesWritten: null,
        connecting: null,
        destroyed: null,
        localAddress: null,
        localPort: null,
        remoteAddress: null,
        remoteFamily: null,
        remotePort: null,
      };
      const information = {
        connection: null,
        status: null,
        client: null,
      };
      let client = null;

      if (node.plc && node.plc.isoclient) {
        client = node.plc.isoclient;
        cli.address = client.address();
        cli.bufferSize = ((client.bufferSize) ? (client.bufferSize) : (null));
        cli.bytesRead = ((client.bytesRead) ? (client.bytesRead) : (null));
        cli.bytesWritten = ((client.bytesWritten) ? (client.bytesWritten) : (null));
        cli.connecting = ((client.connecting) ? (client.connecting) : (null));
        cli.destroyed = ((client.destroyed) ? (client.destroyed) : (null));
        cli.localAddress = ((client.localAddress) ? (client.localAddress) : (null));
        cli.localPort = ((client.localPort) ? (client.localPort) : (null));
        cli.remoteAddress = ((client.remoteAddress) ? (client.remoteAddress) : (null));
        cli.remoteFamily = ((client.remoteFamily) ? (client.remoteFamily) : (null));
        cli.remotePort = ((client.remotePort) ? (client.remotePort) : (null));
      }

      information.connection = node.RFCParam;
      information.status = node.status;
      information.client = cli;

      const ret = customStringify(information);
      // var ret = util.inspect(information);
      return ret;
    }

    function setStatus(sStatus) {
      outputLog('[s7comm-Function] - setStatus (New status:' + sStatus + '). Configuration:[' + node.id + '].', 3);
      if (typeof (sStatus) === 'string') {
        switch (sStatus) {
          case 'connected':
            for (var id in node.users) {
              if (node.users.hasOwnProperty(id)) {
                node.users[id].status({ fill: 'green', shape: 'dot', text: 'connected', });
              }
            }
            break;
          case 'connecting':
            for (var id in node.users) {
              if (node.users.hasOwnProperty(id)) {
                node.users[id].status({ fill: 'blue', shape: 'dot', text: 'connecting', });
              }
            }
            break;
          case 'disconnected':
            for (var id in node.users) {
              if (node.users.hasOwnProperty(id)) {
                node.users[id].status({ fill: 'red', shape: 'dot', text: 'disconnected', });
              }
            }
            break;
          case 'error':
            for (var id in node.users) {
              if (node.users.hasOwnProperty(id)) {
                node.users[id].status({ fill: 'red', shape: 'dot', text: 'error', });
              }
            }
            break;
          default:
            for (var id in node.users) {
              if (node.users.hasOwnProperty(id)) {
                node.users[id].status({ fill: 'red', shape: 'dot', text: 'unknown', });
              }
            }
            break;
        }
      } else {
        for (var id in node.users) {
          if (node.users.hasOwnProperty(id)) {
            node.users[id].status({ fill: 'red', shape: 'dot', text: 'unknown', });
          }
        }
      }
    }

    function clearTimer(handle) {
      switch (handle) {
        case 'handleConnectionTimeout':
          if (node.status.handleConnectionTimeout !== null) {
            outputLog('[s7comm-Function] - Clear Timer: ' + handle, 3);
            clearTimeout(node.status.handleConnectionTimeout);
            node.status.handleConnectionTimeout = null;
          }
          break;
        case 'handleStateInterval':
          if (node.status.handleStateInterval !== null) {
            outputLog('[s7comm-Function] - Clear Timer: ' + handle, 3);
            clearInterval(node.status.handleStateInterval);
            // clearImmediate(node.status.handleStateInterval);
            node.status.handleStateInterval = null;
          }
          break;
        case 'handleLocalTimeout':
          if (node.status.handleLocalTimeout !== null) {
            outputLog('[s7comm-Function] - Clear Timer: ' + handle, 3);
            clearTimeout(node.status.handleLocalTimeout);
            node.status.handleStateInterval = null;
          }
          break;
        case 'readingInterval':
          if (node.status.readingInterval !== null) {
            outputLog('[s7comm-Function] - Clear Timer: ' + handle, 3);
            clearInterval(node.status.readingInterval);
            node.status.readingInterval = null;
          }
          break;
        default:
          outputLog('[s7comm-Error] - Error deleting Timer Handle. Unknown Handle: ' + handle, 0);
          break;
      }
    }

    /**
     * @description This function returns a JSON Object which is used for sending to the nodes output
     * @param {Object} node- A node object from the Node-RED Instance
     * @param {String} path- Name of the signal within S7-Object
     * @param {Number} err- Errorvalue of PLC response (comes from checkReceivedData)
     * @param {Array} val- Return value of PLC response(comes from checkReceivedData)
     * @returns {Object} JSON-Object of each Request
     * @example
     * var a=getJSON(node,'MB0...2', 0,[0,1,2]); //define data as JSON
     * var b=getJSON(node,null     ,-1,[null]);  //Errorobject
     */
    function getJSON(myNode, s7path, err, val) {
      const ret = {
        topic: myNode.topic,
        payload: {
          signal: myNode.dataHandle.rcvData.S7_Name,
          path: s7path,
          error: err,
          value: val,
        },
      };
      return ret;
    }

    /**
     * @description Give this function an S7 Object and it'll return the Datatype.
     * @param {Object} S7Object - The S7-Object that comes from the HTML-Page
     * @param {Number} choose -  Choose 0 or 1 for different format. 1 for using with DB, 0 for using with the rest
     * @returns {String} A string that shows the Datatype of the input Signal
     * @todo Extend this Function when using more Datatypes e.g Int,DInt ...
     * @example 
     * getDataTypeAsString(S7Object,1)  //S7Object={S7_Type:'' ,S7_DBnum:'0',S7_Datatype:'',S7_Offset:'0',S7_BitOffset:'0',S7_Quantity:'0',S7_Name:''}
     * //returns BYTE
     */
    function getDataTypeAsString(S7Object, choose) {
      let ret = '';
      // cases grabbed from HTML file. Object operators2 within oneditprepare in the configuration part!!
      switch (S7Object.S7_Datatype) {
        case 'X':
          ret = ((choose && choose === 'DB') ? ('X') : ('X'));
          break;
        case 'B':
        case 'uint8':
          ret = ((choose && choose === 'DB') ? ('BYTE') : ('B'));
          break;
        case 'W':
        case 'uint16':
          ret = ((choose && choose === 'DB') ? ('WORD') : ('W'));
          break;
        case 'D':
        case 'uint32':
          ret = ((choose && choose === 'DB') ? ('DWORD') : ('D'));
          break;
        case 'I':
        case 'int16':
          ret = ((choose && choose === 'DB') ? ('INT') : ('I'));
          break;
        case 'DI':
        case 'int32':
          ret = ((choose && choose === 'DB') ? ('DINT') : ('DI'));
          break;
        case 'CHAR':
          ret = ((choose && choose === 'DB') ? ('CHAR') : ('C'));
          break;
        case 'STRING':
          ret = ((choose && choose === 'DB') ? ('STRING') : ('S'));
          break;
        case 'R':
          ret = ((choose && choose === 'DB') ? ('REAL') : ('R'));
          break;
        case 'TIMER':
          ret = ((choose && choose === 'DB') ? ('TIMER') : ('TIMER'));// placeholder!
          break;
        case 'COUNTER':
          ret = ((choose && choose === 'DB') ? ('COUNTER') : ('COUNTER'));// placeholder!
          break;
        default:
          ret = undefined;
      }
      return ret;
    }

    /**
     * @description NodeS7 has it's own Syntax for a Request. This Function creates the Syntax for a NodeS7-Request.
     * @param {Object} S7Object - The S7-Object that comes from the HTML-Page
     * @param {String} choose - use 'data' for ... and 'path' for ...
     * @returns {String} A string that defines the Syntax for the Request
     * @todo Extend this Function when using more Datatypes e.g Int,DInt ...
     * @example
     * wrapData(S7Object)(S7Object)
     * //returns EB0 => S7Object={S7_Type:'' ,S7_DBnum:'0',S7_Datatype:'',S7_Offset:'0',S7_BitOffset:'0',S7_Quantity:'0',S7_Name:''}
     */
    function wrapData(S7Object, choose) {
      let ret = S7Object;
      switch (S7Object.S7_Type) {
        case 'I':
        case 'Q': // X,BYTE,WORD,DWORD,INT,DINT,CHAR,STRING,R,TIMER,COUNTER
        case 'M':
        case 'PI':
        case 'PQ':
          if (S7Object.S7_Datatype === 'X') {
            // Bool
            ret = S7Object.S7_Type + S7Object.S7_Offset + '.' + S7Object.S7_BitOffset;// I0.0
          } else if (S7Object.S7_Datatype === 'CHAR') {
            // CHAR
            ret = S7Object.S7_Type + getDataTypeAsString(S7Object) + S7Object.S7_Offset;// MC0
          } else {
            // BYTE,WORD,DWORD,INT,DINT,STRING,R,TIMER,COUNTER
            if (S7Object.S7_Quantity > 1) {
              if (choose === 'path') {
                // IB0-IBx into IB0..x
                ret = S7Object.S7_Type + getDataTypeAsString(S7Object) + S7Object.S7_Offset + '..' + (S7Object.S7_Quantity - 1);
              } else if (choose === 'data') {
                // IB0-IBx into IB0.x
                ret = S7Object.S7_Type + getDataTypeAsString(S7Object) + S7Object.S7_Offset + '.' + S7Object.S7_Quantity;
              } else {
                ret = null;
              }
            } else {
              ret = S7Object.S7_Type + getDataTypeAsString(S7Object) + S7Object.S7_Offset;	// IB0
            }
          }
          break;
        case 'DB':
          if (S7Object.S7_Datatype === 'X') {
            // Bool
            ret = S7Object.S7_Type + S7Object.S7_DBnum + ',' + getDataTypeAsString(S7Object, 'DB') + S7Object.S7_Offset + '.' + S7Object.S7_BitOffset;	// DB10.DBX0.1  into  DB10,X0.1
          } else if (S7Object.S7_Datatype === 'CHAR') {
            // CHAR
            ret = S7Object.S7_Type + S7Object.S7_DBnum + ',' + getDataTypeAsString(S7Object, 'DB') + S7Object.S7_Offset;// DB10.DBC0 into 'DB10,CHAR0'
          } else {
            // BYTE,WORD,DWORD,INT,DINT,STRING,R,TIMER,COUNTER
            if (S7Object.S7_Quantity > 1) {
              // Quantity >1 (array)
              if (choose === 'path') {
                ret = S7Object.S7_Type + S7Object.S7_DBnum + ',' + getDataTypeAsString(S7Object, 'DB') + S7Object.S7_Offset + '..' + (S7Object.S7_Quantity - 1);// DB10.DBW0-DB10.DBW2   into 'DB10,WORD1..2'
              } else if (choose === 'data') {
                ret = S7Object.S7_Type + S7Object.S7_DBnum + ',' + getDataTypeAsString(S7Object, 'DB') + S7Object.S7_Offset + '.' + S7Object.S7_Quantity;// DB10.DBW0-DB10.DBW2   into 'DB10,WORD1.2'
              } else {
                ret = null;// default
              }
            } else {
              ret = S7Object.S7_Type + S7Object.S7_DBnum + ',' + getDataTypeAsString(S7Object, 'DB') + S7Object.S7_Offset;// DB10.DBW0 into 'DB10,WORD1'
            }
          }
          break;
        case 'T':
          ret = S7Object.S7_Type + S7Object.S7_Offset;
          break;
        case 'C':
          ret = S7Object.S7_Type + S7Object.S7_Offset;
          break;
        default:
          ret = null;
      }
      return ret;
    }


    // Connection Management
    function disconnect(cb) {
      outputLog('[s7comm-Function] - disconnect. Configuration:[' + node.id + '], Status: ' + printStatus(), 3);

      stopWatchingStates();

      if (node.plc) {
        node.plc.dropConnection(() => {
          outputLog('[s7comm-Warning] - Connection to PLC ' + node.RFCParam.host.toString() + ' dropped. Configuration:[' + node.id + '], Status: ' + printStatus(), 1);
          setStatus('disconnected');
          node.status.connected = false;
          node.plc = null;
          cb();
        });
      } else {
        setStatus('disconnected');
        node.status.connected = false;
        process.nextTick(cb);
      }
    }

    function connect() {
      outputLog('[s7comm-Function] - connect. Configuration:[' + node.id + '].', 3);
      // Make shure to close a possible instance
      if (node.plc) {
        outputLog('[s7comm-Warning] - Disconnect a prior connection first.', 1);
        disconnect(connectNow);
      } else {
        process.nextTick(connectNow);
      }
    }

    function connectNow() {
      outputLog('[s7comm-Function] - connectNow. Configuration:[' + node.id + '], Status: ' + printStatus(), 3);

      // Create new NodeS7 Instance
      node.plc = new Nodes7(logLevelNodeS7);
      // Patch nodes7 for our purposes !
      node.plc.requestMaxParallel = 1;
      node.plc.maxParallel = 1;

      // Add Item here into the pollinglist
      const arr = [];
      for (let index = 0; index < node.payload.length; index++) {
        const element = node.payload[index];
        const data = wrapData(element, 'data');
        arr.push(data);
      }
      node.plc.addItems(arr);
      outputLog('[s7comm-Info] - New NodeS7 Instance created. Status: ' + printStatus(), 2);

      // Connect
      outputLog('[s7comm-Function] - initiateConnection @' + new Date(), 3);
      node.status.connecting = true;
      node.plc.initiateConnection(node.RFCParam, (err) => {
        outputLog('[s7comm-Info] - Connection Callback occured', 2);
        node.status.connecting = false;
        clearTimer('handleConnectionTimeout');

        if (err) {
          // On Error
          outputLog('[s7comm-Error] - Error occured during Connection Establishment.', 0);
          const myErr = ((typeof (err) === 'object') ? (JSON.stringify(err)) : (err));
          outputLog('[s7comm-Info] - Err: ' + myErr + ',State: -  ' + printStatus(), 2);

          stopWatchingStates();
          setStatus('error');
          node.status.connected = false;
          onConnectionError();
          return;
        }
        // Connected
        outputLog('[s7comm-Warning] - Connection established to PLC ' + node.RFCParam.host.toString() + ':' + node.RFCParam.port.toString(), 1);
        setStatus('connected');
        node.status.connected = true;
        startWatchingStates();

        // Trigger single Reading once, because if intervall reading is huge
        // and we get an external input we get an reading error.
        outputLog('[s7comm-Info] - Single reading once to init values (PLC ' + node.RFCParam.host.toString() + ').', 2);
        node.plc.readAllItems((anythingBad, values) => {
          node.status.reading = false;
          node.readDataBuffer.anythingBad = anythingBad;
          node.readDataBuffer.values = values;
        });

        // Trigger Interval Reading.
        if (node.status.numOfReadNodes >= 1 && node.status.numOfReadIntervallNodes >= 1) {
          node.triggerIntervalReading();
        }
      });
    }

    function stopWatchingStates() {
      outputLog('[s7comm-Function] - stopWatchingStates. Configuration:[' + node.id + '].', 3);
      node.plc.isoclient.setKeepAlive(false);
      node.status.keepAliveRunning = false;

      clearTimer('handleConnectionTimeout');
      clearTimer('handleStateInterval');
      clearTimer('handleLocalTimeout');
      clearTimer('readingInterval');
    }

    function startWatchingStates() {
      outputLog('[s7comm-Function] - startWatchingStates. Configuration:[' + node.id + '].', 3);

      // set KeepAlive
      outputLog('[s7comm-Info] - Enable KeepAlive.', 2);

      node.status.keepAliveRunning = true;
      // Only for process.platform == 'win32'!!
      // sets TCP_KEEPTIME = 3sec, TCP_KEEPINTVL  = 3sec (windows only!), TCP_KEEPPROBES = ?
      node.plc.isoclient.setKeepAlive(true, 3000);

      // For process.platform == 'linux' we use module net-keepalive
      if (NetKeepAlive && node.plc.isoclient) {
        outputLog('[s7comm-Info] - Set the keepalive parameter for linux system.', 2);
        // sets TCP_KEEPTIME = 3sec, TCP_KEEPINTVL  = 3sec, TCP_KEEPPROBES = 8
        const probeInterval = 3000; // after initialDuration send probes every 1 second
        const maxProbesBeforeFail = 3; // after 10 failed probes connection will be dropped
        NetKeepAlive.setKeepAliveInterval(node.plc.isoclient, probeInterval);
        NetKeepAlive.setKeepAliveProbes(node.plc.isoclient, maxProbesBeforeFail);
      }

      // watch States
      outputLog('[s7comm-Info] - Start Watching NodeS7 States.', 2);
      node.status.handleStateInterval = setInterval(() => {
        if (node.plc.isoConnectionState === 4 && node.status.numOfReadIntervallNodes > 0 && node.status.rwCyclError === true) {
          // In case of cyclic reading & pull of cable
          setStatus('error');
          // Don't set because it also can be a read write Error. We don't know it yet
          // node.status.connected = false;
        } else if (node.plc.isoConnectionState === 4) {
          setStatus('connected');
        } else {
          setStatus('disconnected');
          node.status.connected = false;
          stopWatchingStates();
          onConnectionError();
        }
      }, 1000);
    }

    function onConnectionError() {
      outputLog('[s7comm-Function] - onConnectionError. Configuration:[' + node.id + '].', 3);
      disconnect(() => {
        outputLog('[s7comm-Warning] - Reconnection after 3 sec.', 1);
        node.status.handleConnectionTimeout = setTimeout(() => {
          clearTimer('handleConnectionTimeout');
          connect(); // disconnection will be done within connect method
        }, 3000);
      });
    }

    function onNodeClose(cb) {
      outputLog('[s7comm-Warning] - Closed Node event occured: ' + node.id, 1);
      outputLog('[s7comm-Function] - onNodeClose. Configuration:[' + node.id + '].', 3);
      clearTimer('readingInterval');

      stopWatchingStates();
      setStatus('disconnected');
      node.status.connected = false;

      // Only Disconnect. No manual reconnection. Will be done by Node-RED
      disconnect(() => {
        outputLog('[s7comm-Info] - Disconnection Done. Status: ' + printStatus(), 2);
        cb();
      });
    }


    // R/W
    function singleReading() {
      outputLog('[s7comm-Function] - singleReading. Configuration:[' + node.id + '].', 3);
      const nextElem = node.readQueue.shift();
      if (nextElem) {
        outputLog('[s7comm-Info] - Single reading process (PLC ' + node.RFCParam.host.toString() + ') is starting.', 2);
        node.status.reading = true;
        node.plc.readAllItems((anythingBad, values) => {
          outputLog('[s7comm-Info] - Single reading process (PLC ' + node.RFCParam.host.toString() + ') done. Bad Values:' + anythingBad, 2);
          node.status.reading = false;
          node.readDataBuffer.anythingBad = anythingBad;
          node.readDataBuffer.values = values;
          node.readingComplete(nextElem);
          singleReading();
        });
      } else {
        outputLog('[s7comm-Info] - Reading Queue empty. Configuration:[' + node.id + '].', 2);
      }
    }

    function cyclicReading() {
      outputLog('[s7comm-Function] - cyclicReading. Configuration:[' + node.id + '].', 3);
      node.status.reading = true;
      node.plc.readAllItems((anythingBad, values) => {
        outputLog('[s7comm-Info] - Iteration of cyclic reading process from PLC ' + node.RFCParam.host.toString() + ' done.', 2);
        node.status.rwCyclError = anythingBad; // Patch. Can be removed when connection Establishment Issue is solved.
        node.status.reading = false;
        node.readDataBuffer.anythingBad = anythingBad;
        node.readDataBuffer.values = values;
      });
    }

    function singleWriting() {
      outputLog('[s7comm-Function] - singleWriting. Configuration:[' + node.id + '].', 3);
      const nextElem = node.writeQueue.shift();
      if (nextElem) {
        outputLog('[s7comm-Info] - Writing now.', 2);

        node.status.writing = true;
        const myNode = nextElem.node;
        const myName = nextElem.name;
        const myValue = nextElem.val;
        const myError = nextElem.error;
        outputLog('[s7comm-Info] - Single writing process (PLC ' + node.RFCParam.host.toString() + ') is starting.', 2);

        node.plc.writeItems(myName, myValue, (cb) => {
          outputLog('[s7comm-Info] - Single writing process (PLC ' + node.RFCParam.host.toString() + ') done.', 2);
          node.status.writing = false;
          // send the payload
          let err = -1;
          let value = null;

          if (cb === false) {
            err = 0;// the callback from the writing process
          }
          if (myNode.dataHandle.rcvData.S7_Quantity > 1) {
            if (myNode.dataHandle.rcvData.S7_Datatype === 'STRING' || myNode.dataHandle.rcvData.S7_Datatype === 'CHAR') {
              value = myValue;
            } else {
              value = myValue[0];
            }
          } else {
            value = myValue;
          }

          const wrappedPath = wrapData(myNode.dataHandle.rcvData, 'path');

          myNode.NodeConfig.writeJSON = getJSON(myNode, wrappedPath, err, value);
          myNode.send(myNode.NodeConfig.writeJSON);

          singleWriting();// trigger next writing
        });
        // node.status.writing = true;
      } else {
        outputLog('[s7comm-Info] - Writing Queue empty. Configuration:[' + node.id + '].', 2);
      }
    }

    function checkWritingValue(myNode, val) {
      // Input:  value.payload={'value':[1]}
      // Return: val= { error: false, value: [ 2 ] }
      outputLog('[s7comm-Function] - checkWritingValue. Configuration:[' + node.id + '].', 3);
      
      let ret = null;
      const tmp = [];
      let err = null;
      let fatalError = false;

      for (let i = 0; i < val.length; i++) {
        tmp[i] = val[i];
        err = false;

        if (myNode.dataHandle.rcvData.S7_Datatype === 'B' || myNode.dataHandle.rcvData.S7_Datatype === 'uint8') { // 0x00 <= Byte <= 255
          if (val[i] < 0x00) {
            tmp[i] = 0;
          } else {
            tmp[i] = val[i] % (255 + 1);
          }
        }
        if (myNode.dataHandle.rcvData.S7_Datatype === 'W' || myNode.dataHandle.rcvData.S7_Datatype === 'uint16') { // 0x0000 <= Word <= 65535
          if (val[i] < 0) {
            tmp[i] = 0;
          } else {
            tmp[i] = val[i] % (65535 + 1);
          }
        }
        if (myNode.dataHandle.rcvData.S7_Datatype === 'D' || myNode.dataHandle.rcvData.S7_Datatype === 'uint32') { // 0x00000000 <= DWord <= 4294967295
          if (val[i] < 0) {
            tmp[i] = 0;
          } else {
            tmp[i] = val[i] % (4294967295 + 1);
          }
        }
        if (myNode.dataHandle.rcvData.S7_Datatype === 'I' || myNode.dataHandle.rcvData.S7_Datatype === 'int16') { // -32768 <= INT <= 32767
          if (val[i] < 0) {
            tmp[i] = val[i] % (32768 + 1);
          } else if (val[i] > 0) {
            tmp[i] = val[i] % (32767 + 1);
          } else {
            tmp[i] = val[i] % (32767 + 1);
          }
        }
        if (myNode.dataHandle.rcvData.S7_Datatype === 'DI' || myNode.dataHandle.rcvData.S7_Datatype === 'int32') { // -2147483648 <= INT <= 2147483647	
          if (val[i] < 0) {
            tmp[i] = val[i] % (2147483648 + 1);
          } else if (val[i] > 0) {
            tmp[i] = val[i] % (2147483647 + 1);
          } else {
            tmp[i] = val[i] % (2147483647 + 1);
          }
        }
        if (myNode.dataHandle.rcvData.S7_Datatype === 'X') {
          if (typeof (val[i]) !== 'boolean') {
            fatalError = true;
          }
        }
        if (myNode.dataHandle.rcvData.S7_Datatype === 'CHAR') {
          let x = '';
          if (typeof (val[i]) !== 'string') {
            fatalError = true;
          } else {
            if ((val[i]).length > 1) {
              err = true;
              x = (val[i]).slice(0, 1);
            } else {
              x = val[i];
            }
            if (x === '') {
              tmp[i] = ' ';
            } else {
              tmp[i] = x;
            }
          }
        }
        if (myNode.dataHandle.rcvData.S7_Datatype === 'STRING') {
          if (typeof (val[i]) !== 'string') {
            fatalError = true;
          } else {
            if ((val[i]).length > myNode.dataHandle.rcvData.S7_Quantity) {
              err = true;
              tmp[i] = (val[i]).slice(0, myNode.dataHandle.rcvData.S7_Quantity);
            }
          }
        }
        if (myNode.dataHandle.rcvData.S7_Datatype === 'R') {
          if (isNumeric(val[i])) {
            tmp[i] = val[i];
          } else {
            tmp[i] = 0;
            err = true;
          }
        }
        if (myNode.dataHandle.rcvData.S7_Datatype === 'TIMER') {
          // TODO: Howto validate value
        }
        if (myNode.dataHandle.rcvData.S7_Datatype === 'COUNTER') {
          // TODO: Howto validate value
        }
      }
      if (fatalError === true) {
        ret = null;
      } else {
        // writingValue is always an array so redefine item
        if (myNode.dataHandle.rcvData.S7_Quantity > 1) {
          // cut off the overload of the array
          if (isNumeric(myNode.dataHandle.rcvData.S7_Quantity)) {
            ret = {
              'error': err,
              'value': [tmp.slice(0, parseInt(myNode.dataHandle.rcvData.S7_Quantity))],
            };
            if (myNode.dataHandle.rcvData.S7_Datatype == 'CHAR' || myNode.dataHandle.rcvData.S7_Datatype == 'STRING') {
              ret = { 'error': err, 'value': tmp };
            } else {
              ret = {
                'error': err,
                'value': [tmp.slice(0, parseInt(myNode.dataHandle.rcvData.S7_Quantity))],
              };
            }
          } else {
            // value of Quantity Field is not a number
            tmp[i] = 0;
            err = true;
          }
        } else {
          ret = { 'error': err, 'value': tmp };
        }
      }
      return ret;
    }

    // global methods from r/w node
    // Register r/w node in list
    node.register = (myNode, cb) => {
      outputLog('[s7comm-Function] - register. Node:[' + myNode.id + '].', 3);
      node.users[myNode.id] = myNode;
      outputLog('[s7comm-Function] - configureIntervalReading. Configuration:[' + node.id + '].', 3);

      // Configure interval reading
      for (var i in node.users) {
        if (node.users[i].type === 's7comm write') {
          node.status.numOfWriteNodes++;// increase Quantity of writing nodes
        }
        if (node.users[i].type === 's7comm read') {
          node.status.numOfReadNodes++;// increase Quantity of nodes with name 'read'

          // set interval time
          if (node.users[i].nodeTiming.repeat && !isNaN(node.users[i].nodeTiming.repeat) && node.users[i].nodeTiming.repeat > 0) {
            // Repeat choosed !!
            node.status.numOfReadIntervallNodes++

            node.status.readCyclArray.push(node.users[i].nodeTiming.repeat);			      // get repeat value and push it into an array
            node.status.readIntervalTime = (Array.min(node.status.readCyclArray)) / 2;	// get Array minimum,set it to interval time.
            if (node.status.readIntervalTime < 200) {
              node.status.readIntervalTime = 200;
            }
          }
        }
      }

      // Connect here to prevent connecting when no nodes are in use
      if (Object.keys(node.users).length === 1) {
        connect(); // connect within s7comm
      }
      cb();
    };

    // Deregister r/w node from list
    node.deregister = (myNode, cb) => {
      outputLog('[s7comm-Function] - Deregister. Node:[' + myNode.id + '].', 3);
      delete node.users[myNode.id];
      return cb();
    };

    // trigger the intervall reading process
    node.triggerIntervalReading = () => {
      outputLog('[s7comm-Function] - triggerIntervalReading. Node:[' + node.id + '].', 3);
      outputLog('[s7comm-Info] - Trigger interval reading process of PLC ' + node.RFCParam.host.toString(), 2);

      if (!node.status.connected) {
        outputLog('[s7comm-Error] - Error during reading process. No Connection to ' + node.RFCParam.host.toString() + '.', 0);
        // node.readJSON = getJSON(node, null, 1, FilledArray(1, null));
        // node.send(node.readJSON);
      } else {
        // reset
        if (node.status.readingInterval !== null) {
          clearTimeout(node.status.readingInterval);
        }
        node.status.readingInterval = setInterval(cyclicReading, node.status.readIntervalTime);
      }
    };

    // trigger the single reading process
    node.triggerSingleReading = (myNode) => {
      outputLog('[s7comm-Function] - triggerSingleReading. Node:[' + myNode.id + '].', 3);
      outputLog('[s7comm-Info] - Trigger single reading process to PLC ' + myNode.NodeConfig.RFCParam.host.toString(), 2);

      const wrappedPath = wrapData(myNode.dataHandle.rcvData, 'path');

      if (!myNode.NodeConfig.status.connected) {
        outputLog('[s7comm-Error] - Error during reading process. No Connection to ' + node.RFCParam.host.toString() + '.', 0);
        /* eslint-disable-next-line */
        myNode.NodeConfig.readJSON = getJSON(myNode, wrappedPath, 1, FilledArray(myNode.dataHandle.rcvData.S7_Quantity, null));
        myNode.send(myNode.NodeConfig.readJSON);
      } else {
        node.readQueue.push(myNode);
        if (!node.status.reading) {
          singleReading();
        }
      }
    };

    // trigger the single reading process
    node.readingComplete = (myNode) => {
      outputLog('[s7comm-Function] - readingComplete. Node:[' + myNode.id + '].', 3);
      const wrappedData = wrapData(myNode.dataHandle.rcvData, 'data');
      const wrappedPath = wrapData(myNode.dataHandle.rcvData, 'path');

      if (wrappedData === null) {
        outputLog('[s7comm-Error] - No Signal selected within the reading node. WrappedData:' + wrappedData, 0);
        /* eslint-disable-next-line */
        myNode.NodeConfig.readJSON = getJSON(myNode, wrappedPath, -1, FilledArray(myNode.dataHandle.rcvData.S7_Quantity, null));
        myNode.send(myNode.NodeConfig.readJSON);
      } else if (Object.keys(myNode.NodeConfig.readDataBuffer).length === 0 && myNode.NodeConfig.readDataBuffer.constructor === Object) {
        // No Data. Due to no Connection or anything else. This can happen during cyclic reading & No connection
        outputLog('[s7comm-Error] - No response values from reading request available. Wrong Buffer. ReadDataBuffer:' + myNode.NodeConfig.readDataBuffer, 0);
        /* eslint-disable-next-line */
        myNode.NodeConfig.readJSON = getJSON(myNode, wrappedPath, -1, FilledArray(myNode.dataHandle.rcvData.S7_Quantity, null));
        myNode.send(myNode.NodeConfig.readJSON);
      } else if (!myNode.NodeConfig.readDataBuffer.values) {
        // No Data. Due to no Connection or anything else. This can happen during cyclic reading & No connection
        outputLog('[s7comm-Error] - No response values from reading request available. No Buffer Value. Values:' + myNode.NodeConfig.readDataBuffer, 0);
        /* eslint-disable-next-line */
        myNode.NodeConfig.readJSON = getJSON(myNode, wrappedPath, -1, FilledArray(myNode.dataHandle.rcvData.S7_Quantity, null));
        myNode.send(myNode.NodeConfig.readJSON);
      } else {
        outputLog('[s7comm-Info] - Processing Response data of Reading Process.', 2);
        // Checks the return object of a reading process and sets quality and value in a defined form.
        // The Node-RED node contains a parameter which represent the return value of an reading process see example.
        // With obj={anythingBad: false,values:{ 'DB11102,BYTE14.4':[ 3, 2, 97, 98 ]}}
        // We return for each node {err:0,arr:[ 3, 2, 97, 98 ]}
        // A response value can either be a decimal value or string 'BAD x' if an Error occured
        // single Item or Array if the Quantity is >1

        const tmp = { err: -1, arr: [null] };// buffer for receiving val {anythingBad:bool,values: { MB1: 5, MW10: 4, etc }}
        const data = myNode.NodeConfig.readDataBuffer;
        const dataBadData = data.anythingBad;
        const dataValues = data.values[wrappedData];

        if (dataValues !== undefined || dataValues !== null) {
          if (dataBadData === false) {
            // no Error
            tmp.err = 0;
            tmp.arr = [null];
            if (!Array.isArray(dataValues)) {
              tmp.arr = [dataValues];// single value!
            } else {
              tmp.arr = dataValues;// array!
            }
          } else if (dataBadData === true) {
            // Error
            if (!Array.isArray(dataValues)) {
              tmp.err = 0;
              // single value!
              if (dataValues === undefined || (typeof (dataValues) === 'string' && dataValues.search('BAD') === 0)) {
                tmp.err = -1;
                tmp.arr = [null];
              } else {
                tmp.arr = [dataValues];
              }
            }
            if (Array.isArray(dataValues)) { // array!
              tmp.err = 0;
              for (var i in dataValues) {
                if (dataValues[i] === undefined || (typeof (dataValues[i]) === 'string' && dataValues[i].search('BAD') === 0)) {
                  tmp.err = -1;
                  tmp.arr[i] = null;
                } else {
                  tmp.arr[i] = dataValues[i];
                }
              }
            }
          }
          myNode.NodeConfig.readJSON = getJSON(myNode, wrappedPath, tmp.err, tmp.arr);
        } else {
          outputLog('[s7comm-Error] - No response values from reading request available. No Data. Error:' + dataBadData + ',Values:' + dataValues, 0);
          /* eslint-disable-next-line */
          myNode.NodeConfig.readJSON = getJSON(myNode, wrappedPath, -1, FilledArray(myNode.dataHandle.rcvData.S7_Quantity, null));
        }
        /* eslint-disable-next-line */
        
        myNode.send(myNode.NodeConfig.readJSON);
      }
    };

    // trigger the single writing process
    node.triggerSingleWriting = (myNode, value) => {
      outputLog('[s7comm-Function] - triggerSingleWriting. Node:[' + myNode.id + '].', 3);
      outputLog('[s7comm-Info] - Trigger single writing process to PLC ' + myNode.NodeConfig.RFCParam.host.toString(), 2);

      const wrappedData = wrapData(myNode.dataHandle.rcvData, 'data');// raw Item
      const wrappedPath = wrapData(myNode.dataHandle.rcvData, 'path');// formated Item (change format in case quantity >1)

      if (!myNode.NodeConfig.status.connected) {
        outputLog('[s7comm-Error] - Error during writing process. No Connection to ' + node.RFCParam.host.toString() + '.', 0);
        /* eslint-disable-next-line */
        myNode.NodeConfig.writeJSON = getJSON(myNode, wrappedPath, 1, FilledArray(1, null));
        myNode.send(myNode.NodeConfig.writeJSON);
      } else if (wrappedData === null) {
        outputLog('[s7comm-Error] - Error during writing process. Invalid Data', 0);
        /* eslint-disable-next-line */
        myNode.NodeConfig.writeJSON = getJSON(myNode, wrappedPath, -1, FilledArray(1, null));
        myNode.send(myNode.NodeConfig.writeJSON);
      } else if (typeof (value.payload) !== 'object' && value.payload.value) {
        outputLog('[s7comm-Error] - Error during writing process. Invalid writing Data. Data:' + value.payload, 0);
        /* eslint-disable-next-line */
        myNode.NodeConfig.writeJSON = getJSON(myNode, wrappedPath, -1, FilledArray(1, null));
        myNode.send(myNode.NodeConfig.writeJSON);
      } else {
        const val = checkWritingValue(myNode, value.payload.value);

        if (val === null) {
          outputLog('[s7comm-Error] - Error during writing process. Verified Data is null.', 0);
          /* eslint-disable-next-line */
          myNode.NodeConfig.writeJSON = getJSON(myNode, wrappedPath, -1, FilledArray(1, null));
          myNode.send(myNode.NodeConfig.writeJSON);
        } else {
          const element = {
            node: myNode,
            name: [wrappedData],
            val: val.value,
            error: val.error,
          };
          myNode.NodeConfig.writeQueue.push(element);
          if (!myNode.NodeConfig.status.writing) {
            singleWriting();
          }
        }
      }
    };

    // on deploy
    node.on('close', onNodeClose);
  }

  RED.nodes.registerType('s7comm', S7Configuration);

  function S7Read(n) {
    RED.nodes.createNode(this, n);
    // Node Params passed by Node Red
    this.id = n.id;
    this.connection = n.connection;
    this.type = n.type;
    this.NodeConfig = RED.nodes.getNode(this.connection);
    this.topic = n.topic;
    this.name = n.name;
    this.payload = n.payload;

    this.nodeTiming = {
      repeat: n.repeat,
      intervalReading: n.none, // none=true => reading once; none=false means=> interval rading
      stateIntervalHandle: null,
      once: n.once,
      onceDelay: (n.onceDelay || 0.1) * 1000,
      onceTimeout: null,
      cronjob: null,
      crontab: null,
    };

    this.dataHandle = {
      rcvData: undefined,
    };

    // local parameter & functions
    const node = this;

    node.repeaterSetup = () => {
      if (node.nodeTiming.repeat > 2147483) {
        node.error(RED._('repeat.errors.toolong', node));
        node.nodeTiming.repeat = 2147483;
      }
      if (node.nodeTiming.repeat && !isNaN(node.nodeTiming.repeat) && node.nodeTiming.repeat > 0) {
        node.nodeTiming.repeat = node.nodeTiming.repeat * 1000;
        if (RED.settings.verbose) {
          node.log(RED._('node.repeat', node));
        }
        node.nodeTiming.stateIntervalHandle = setInterval(() => {
          node.emit('input', {});
        }, node.nodeTiming.repeat);
      }
    };

    node.status({ fill: 'red', shape: 'dot', text: 'missing configuration' });

    if (node.NodeConfig) {
      // Wrap payload and put it into the pollinglist
      if (node.payload !== undefined && node.payload !== '') {
        node.dataHandle.rcvData = JSON.parse(node.payload);
      }

      // Set up Timing
      if (node.nodeTiming.once) {
        node.nodeTiming.onceTimeout = setTimeout(() => {
          node.emit('input', {});
          node.repeaterSetup();
        }, node.nodeTiming.onceDelay);
      } else {
        node.repeaterSetup();
      }

      node.NodeConfig.register(node, () => {
        node.on('input', () => {
          if (node.nodeTiming.intervalReading === 'true' && node.NodeConfig.status.numOfReadNodes >= 1) {
            node.NodeConfig.triggerSingleReading(node);
          } else if (node.nodeTiming.intervalReading === 'false') {
            node.NodeConfig.readingComplete(node);
          }
        });
      });

      node.on('close', (done) => {
        if (node.nodeTiming.stateIntervalHandle !== null) {
          clearInterval(node.nodeTiming.stateIntervalHandle);
        }
        if (RED.settings.verbose) {
          node.log(RED._('inject.stopped'));
        }
        if (node.NodeConfig) {
          node.NodeConfig.deregister(node, done);
        }
      });
    }
  }
  RED.nodes.registerType('s7comm read', S7Read);


  function S7Write(n) {
    RED.nodes.createNode(this, n);
    // Node Params passed by Node Red
    this.id = n.id;
    this.type = n.type;
    this.connection = n.connection;
    this.NodeConfig = RED.nodes.getNode(this.connection);
    this.topic = n.topic;
    this.name = n.name;
    this.payload = n.payload;

    // local parameter & functions
    this.dataHandle = {
      rcvData: undefined,
    };
    const node = this;

    node.status({ fill: 'red', shape: 'dot', text: 'missing configuration' });
    if (node.NodeConfig) {
      // Wrap payload
      if (node.payload !== '' && node.payload !== '"undefined"') {
        node.dataHandle.rcvData = JSON.parse(node.payload);
      }
      node.NodeConfig.register(node, () => {
        node.on('input', (msg) => {
          node.NodeConfig.triggerSingleWriting(node, msg);
        });
      });
      node.on('close', (done) => {
        if (node.NodeConfig) {
          if (RED.settings.verbose) {
            this.log(RED._('inject.stopped'));
          }
          node.NodeConfig.deregister(node, done);
        }
      });
    }
  }
  RED.nodes.registerType('s7comm write', S7Write);
};
