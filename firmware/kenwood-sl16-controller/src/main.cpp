#include <Arduino.h>

// Kenwood AX-7 SL16 controller.
// TIP  (BUSY) -> 10 kOhm -> D2
// RING (DATA) -> 10 kOhm -> D3
// SLEEVE      -> GND
// The C-AX7 must be disconnected while this firmware transmits.

constexpr uint8_t BUSY_PIN = 2; // TIP
constexpr uint8_t DATA_PIN = 3; // RING

constexpr uint16_t CMD_2_CHANNEL = 0xBF70;
constexpr uint16_t CMD_4_CHANNEL = 0xBFF0;

constexpr uint16_t POWER_ON_SEQUENCE[] = {
  0xBFB8, 0xBFFF, 0xBF74, 0xBFF0, 0xBF78
};

constexpr uint16_t POWER_OFF_SEQUENCE[] = {
  0xBF7F, 0xBF38, 0xBFB8
};

void releaseBus() {
  pinMode(BUSY_PIN, INPUT);
  pinMode(DATA_PIN, INPUT);
}

bool busIsIdle() {
  return digitalRead(BUSY_PIN) == LOW && digitalRead(DATA_PIN) == LOW;
}

bool sendSl16(uint16_t command) {
  if (!busIsIdle()) {
    Serial.print(F("ABORT bus_not_idle busy="));
    Serial.print(digitalRead(BUSY_PIN));
    Serial.print(F(" data="));
    Serial.println(digitalRead(DATA_PIN));
    return false;
  }

  // Establish LOW before enabling either output to avoid a startup glitch.
  digitalWrite(BUSY_PIN, LOW);
  digitalWrite(DATA_PIN, LOW);
  pinMode(BUSY_PIN, OUTPUT);
  pinMode(DATA_PIN, OUTPUT);

  // SL16 start bit: DATA low 5 ms, then high 5 ms while BUSY is high.
  digitalWrite(BUSY_PIN, HIGH);
  delay(5);
  digitalWrite(DATA_PIN, HIGH);
  delay(5);

  // 16 bits, MSB first. LOW is 2 ms for 1 and 5 ms for 0;
  // every bit is followed by DATA high for 2 ms.
  for (uint16_t mask = 0x8000; mask != 0; mask >>= 1) {
    digitalWrite(DATA_PIN, LOW);
    delay((command & mask) ? 2 : 5);
    digitalWrite(DATA_PIN, HIGH);
    delay(2);
  }

  digitalWrite(DATA_PIN, LOW);
  digitalWrite(BUSY_PIN, LOW);
  delay(1);
  releaseBus();

  Serial.print(F("SENT 0x"));
  if (command < 0x1000) Serial.print('0');
  Serial.println(command, HEX);
  return true;
}

template <size_t N>
void sendSequence(const uint16_t (&sequence)[N], const __FlashStringHelper* name) {
  Serial.print(F("SEQUENCE_BEGIN "));
  Serial.println(name);
  for (size_t i = 0; i < N; ++i) {
    if (!sendSl16(sequence[i])) {
      Serial.println(F("SEQUENCE_ABORTED"));
      return;
    }
    // The measured C-AX7 gap was approximately 0.96 ms. sendSl16 already
    // holds the released bus for 1 ms before returning.
  }
  Serial.print(F("SEQUENCE_END "));
  Serial.println(name);
}

void printHelp() {
  Serial.println(F("Commands:"));
  Serial.println(F("  o = power-on sequence"));
  Serial.println(F("  t = power-on sequence, then set 2 channels"));
  Serial.println(F("  f = power-off sequence"));
  Serial.println(F("  2 = set 2 channels (0xBF70)"));
  Serial.println(F("  4 = set 4 channels (0xBFF0)"));
  Serial.println(F("  s = bus status"));
  Serial.println(F("  h = help"));
}

void printStatus() {
  Serial.print(F("STATUS busy="));
  Serial.print(digitalRead(BUSY_PIN));
  Serial.print(F(" data="));
  Serial.println(digitalRead(DATA_PIN));
}

void setup() {
  releaseBus();
  Serial.begin(115200);
  delay(50);
  Serial.println(F("KENWOOD_SL16_CONTROLLER_READY"));
  Serial.println(F("Passive after reset; C-AX7 must remain disconnected"));
  printStatus();
  printHelp();
}

void loop() {
  if (!Serial.available()) return;

  const char command = static_cast<char>(Serial.read());
  switch (command) {
    case 'o':
    case 'O':
      sendSequence(POWER_ON_SEQUENCE, F("POWER_ON"));
      break;
    case 't':
    case 'T':
      sendSequence(POWER_ON_SEQUENCE, F("POWER_ON_2CH"));
      sendSl16(CMD_2_CHANNEL);
      break;
    case 'f':
    case 'F':
      sendSequence(POWER_OFF_SEQUENCE, F("POWER_OFF"));
      break;
    case '2':
      sendSl16(CMD_2_CHANNEL);
      break;
    case '4':
      sendSl16(CMD_4_CHANNEL);
      break;
    case 's':
    case 'S':
      printStatus();
      break;
    case 'h':
    case 'H':
    case '?':
      printHelp();
      break;
    case '\r':
    case '\n':
    case ' ':
      break;
    default:
      Serial.print(F("UNKNOWN_COMMAND "));
      Serial.println(command);
      break;
  }
}
