const GoogleSpreadsheet = require('google-spreadsheet')
const {promisify} = require ('util')
const fetch = require("node-fetch")
const creds = require('./client_secret.json')
const Moment = require('moment-timezone')

let newRow = {
    traffic : 0
}

async function getTrafficData() 
{ 
    // CAUTION: bbox params in fetch() might need to be adjusted when changing streetA || streetB
    // Further info: https://developer.here.com/documentation/map-image/topics/examples-map-bbox.html || google "HERE API DOCS Bounding Box"
    const streetA = 'B27'
    const streetB  = 'Hauptbahnhof/Arnulf-Klett Platz'
    try {             
        let res = await fetch(`https://traffic.api.here.com/traffic/6.2/flow.json?app_id=l2ZUStavlolyoBDSeP5w&app_code=jyvziQQB-h7v0EgYuSarJg&bbox=48.784,9.178;48.7849,9.1789`)                
        let data = await res.json()              
        data.RWS[0].RW.forEach((RW) => {      
            if (RW.DE !== streetA) {
                return
            }     
            RW.FIS.forEach((FIS) => {                
                FIS.FI.forEach((FI) => {
                    if (FI.TMC.DE !== streetB) {
                        return
                    }                      
                    newRow.traffic = newRow.traffic + FI.CF[0].JF
                    console.log(`Adding ${FI.CF[0].JF} to newRow.traffic`)
                })
            })
        })
    } catch (error) {
        console.log(error)
    }
}

async function getDustData() 
{ 
    try {                 
  let res = await fetch(`https://data.sensor.community/airrohr/v1/sensor/13171/`);  
  let data = await res.json()      
  updateNewRow(data)
    } catch (error) {
        console.log(error)
    }
}

async function getTempAndHumData() 
{ 
    try {          
  let res = await fetch(`https://data.sensor.community/airrohr/v1/sensor/13172/`)
  let data = await res.json()    
  updateNewRow(data)
    } catch (error) {
        console.log(error)
    }
}

function updateNewRow(data){    
    data.forEach( async (row) => {                                
          row.sensordatavalues.forEach((sdv) =>{                        
            switch (sdv.value_type) {
                case 'P1':
                    newRow.p1 = sdv.value
                    break;
            
                case 'P2':
                    newRow.p2 = sdv.value
                    break;
            
                case 'humidity':
                    newRow.humidity = sdv.value
                    break;
            
                case 'temperature':
                    newRow.temperature = sdv.value
                    break;
            
                default:
                    console.log('no value type matches..')
                    break;
            }
         })
        })
}

async function writeToGooglesheet() {
    try {            
        newRow.timestamp = Moment(new Date()).add(0, 'hours') // change int before hours to modify the timestamp
        const doc = new GoogleSpreadsheet('1zeqER3VPvDQtGC9A3McVnOkpgAXBP0xAR1Y74pOZxgM')
        await promisify(doc.useServiceAccountAuth)(creds)
        const info = await promisify(doc.getInfo)()
        const mainSheet = info.worksheets[0]   // all data is here
        const todaySheet = info.worksheets[1]  // used for creating the 24 hour iframes          
        const weekSheet = info.worksheets[2]   // used for creating the 7 day iframes        
        const sheets = [mainSheet, todaySheet, weekSheet]     
        sheets.map( async (sheet) => {
            await promisify(sheet.addRow)(newRow).catch((err) => {
                console.log('Error when adding rows', err)
            })
        })

        console.log(`added newRow: time: ${newRow.timestamp}, p1: ${newRow.p1}, p2: ${newRow.p2}, hum: ${newRow.humidity}, temp: ${newRow.temperature}, traffic: ${newRow.traffic} `)                    
    } catch (error) {
        console.log(error)
    }
}

function clearData(){
    newRow = {} // clear data
    newRow.traffic = 0 // set value to zero because of getTrafficData() is adding up traffic data from both directions of the street
}

async function runScript(){
    await getTrafficData()   
    await getDustData()
    await getTempAndHumData()    
    await writeToGooglesheet()   
    clearData()    
}

runScript() // run script at start - so no waiting time of 10 mins for first operation
console.log('server running...')
setInterval(runScript, 600000) // run script every 10 mins = 600000 ms