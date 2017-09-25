load('api_blynk.js');
load('api_timer.js');
load('api_gpio.js');
load('api_math.js');
load("api_adc.js");
load('api_sys.js');
// mos config-set blynk.auth={TOKEN}
let Current_moist_lvl = 0; // the latest reading of moist
let debug = 1;
let bk = {
  LED: {
    PIN: 9,
    ON: 255,
    OFF: 0,
  },
  BLYNK_GREEN: "#23C48E",
  BLYNK_YELLOW: "#ED9D00",
  BLYNK_RED: "#D3435C",
};

function dPrint(str, value){
  if (debug === 1) print(str, value );
}
// calucate SoilSensor reading into percentage
function mapPercent(value, high, low) {
  dPrint("READ ORIGINAL: ", value);
  return Math.round(Math.abs(value - high) / (high - low) * 100);
}

// Soilsensor handler
// PIN: trigger pin
// MAX: reading when inside water
// min: reading when out of water
let SoilSensor = {
  PIN: 0,
  MAX: 1024,
  MIN: 650,
  read: function(pin) {
    let rPin = pin || SoilSensor.PIN;
    if(ADC.enable(rPin)) {
      let readLevel = ADC.read(rPin) ;
      Current_moist_lvl = readLevel ;
      return mapPercent(readLevel, SoilSensor.MAX, SoilSensor.MIN);
    }
    return 0;
  },
};

// Watering handler
// RELAY_1: the relay control water pump (high voltage relay)
// TIMER: how long it watering the plant
// TIMER_ON: if ON is 1, off is 0
// start / stop watering action
let Watering = {
  RELAY_1: 16,
  TIMER: 60000,
  TIMER_ON: 0,
  start: function(){
    if (Watering.TIMER_ON === 1 ) {
       dPrint("TIMER ON block start");
       return;
    }
    dPrint('START WATER! ', Current_moist_lvl);
    dPrint('START PIN ', Watering.RELAY_1, " : ", GPIO.read(Watering.RELAY_1));
    Watering.TIMER_ON = 1;
    GPIO.write(Watering.RELAY_1, 1);
    Timer.set(Watering.TIMER, false, function() {
      Watering.stop();
      Watering.TIMER_ON = 0;
    }, null);
    return;
  },
  stop: function(){
    if (Watering.TIMER_ON === 1 ) {
      dPrint("TIMER ON block stop");
      return;
    }
    GPIO.write(Watering.RELAY_1, 0);
    dPrint('STOP WATER! ', Current_moist_lvl);
    dPrint('STOP PIN ', Watering.RELAY_1, " : ", GPIO.read(Watering.RELAY_1));
    return;
  }
};
// Main flow controller
// WATER_LEVEL: start point watering level default 50%
// GREEN_LEVEL: end point of watering
let flow = {
  WATER_LEVEL: 50,
  GREEN_LEVEL: 80,
  _init: function(){
    GPIO.set_mode(Watering.RELAY_1, GPIO.MODE_OUTPUT);
  },
  start: function(){
    let mosit_level = SoilSensor.read();
    dPrint('*** mosit level: ', mosit_level, '%');
    if (Watering.TIMER_ON === 1 ) {
      dPrint("TIMER ON block flow.start");
      return;
    }

    if (mosit_level > this.GREEN_LEVEL){
      // Blynk.virtualWrite(conn, bk.LED, bk.BLYNK_GREEN );
      dPrint('Green >  ', this.GREEN_LEVEL);
      Watering.stop();
    } else if (mosit_level > this.WATER_LEVEL){
      // Blynk.virtualWrite( bk.LED, bk.BLYNK_YELLOW );
      dPrint('Yellow >  ', this.WATER_LEVEL);
      Watering.start();
    } else {
      dPrint('something wrong! ', mosit_level);
      Watering.stop();
    }
    return;
  }
};

Blynk.setHandler(function(conn, cmd, pin, val, id) {
  let ram = Sys.free_ram() / 1024;
  if (cmd === 'vr') {
    // When reading any virtual pin, report free RAM in KB
    dPrint("!!!! BLYNK READING!!!");
    Blynk.virtualWrite(conn, pin, ram, id);
    if (Current_moist_lvl > flow.GREEN_LEVEL){
      dPrint('BK Green! ', Current_moist_lvl);
      // Blynk.virtualWrite(conn, bk.LED.PIN, bk.LED.ON, id);
    } else if (mosit_level > flow.WATER_LEVEL){
      dPrint('BK YELLOW! ', Current_moist_lvl);
      // Blynk.virtualWrite(conn, bk.LED.PIN, bk.LED.ON, id);
    } else {
      dPrint('BK red! ', Current_moist_lvl);
      // Blynk.virtualWrite(conn, bk.LED.PIN, bk.LED.ON, id);
    }
  } else if (cmd === 'vw') {
    // Writing to virtual pin translate to writing to physical pin
    GPIO.set_mode(pin, GPIO.MODE_OUTPUT);
    Watering.start()
    GPIO.write(pin, val);
  }
  dPrint('BLYNK JS handler ', cmd, id, pin, val);
  dPrint('BLYNK JS handler: RAM ', ram);
}, null);

flow._init();

Timer.set(2000 /* milliseconds */, true /* repeat */, function() {
  flow.start();
}, null);
