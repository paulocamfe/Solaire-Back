// Bibliotecas
#include <WiFi.h>
#include <HTTPClient.h>
#include <Servo.h>

// ---- Pinos ----
#define VOLTAGE_PIN 35
#define CURRENT_PIN 36
#define LDR_PIN     34
#define SERVO_PIN   13

// ---- Calibração ----
const float VOLTAGE_DIVIDER_RATIO = 11.0;
const float SENSOR_SENSITIVITY = 0.100;
const float SENSOR_OFFSET = 2.5;

// ---- WiFi ----
const char* ssid = "SALA";
const char* password = "123456789";

// ---- URL DO BACKEND SOLAIRE ----
String serverName = "http://10.92.199.16:3000/esp32/send";

// ID fixo da empresa (TESTE)
// Depois você substitui por uma variável vinda do banco
int companyId = 1;

// ---- Servo ----
Servo solarServo;

void setup() {
  Serial.begin(9600);
  
  solarServo.attach(SERVO_PIN);
  solarServo.write(90);

  WiFi.begin(ssid, password);
  Serial.print("Conectando no WiFi...");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWifi conectado!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    
    // ---- Leitura dos sensores ----
    int rawVoltage = analogRead(VOLTAGE_PIN);
    float voltage = (rawVoltage * (3.3 / 4095.0)) * VOLTAGE_DIVIDER_RATIO;

    int rawCurrent = analogRead(CURRENT_PIN);
    float current = ((rawCurrent * (3.3 / 4095.0)) - SENSOR_OFFSET) / SENSOR_SENSITIVITY;
    if (current < 0) current = 0;

    float power = voltage * current;

    int lightValue = analogRead(LDR_PIN);

    int servoAngle = map(lightValue, 0, 4095, 0, 180);
    solarServo.write(servoAngle);

    float temperature = 25.0; // se quiser acrescentar sensor depois

    // ---- Envio para backend ----
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    String json = "{";
    json += "\"companyId\":" + String(companyId) + ",";
    json += "\"voltage\":" + String(voltage) + ",";
    json += "\"current\":" + String(current) + ",";
    json += "\"power\":" + String(power) + ",";
    json += "\"light\":" + String(lightValue) + ",";
    json += "\"temperature\":" + String(temperature) + ",";
    json += "\"servoAngle\":" + String(servoAngle);
    json += "}";

    int code = http.POST(json);

    Serial.println("\n---- Enviado ----");
    Serial.println(json);
    
    if (code > 0) Serial.println("Sucesso! Código: " + String(code));
    else Serial.println("Falha! Código: " + String(code));

    http.end();
  }

  delay(5000);
}
