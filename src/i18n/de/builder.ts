import type { builderEn } from '../en/builder.ts'
import type { Translation } from '../types.ts'

export const builderDe = {
  'builder.details.limiterRangeHint': 'Steuert die Reaktion des Begrenzers im Bereich seines Grenzwerts.',
  // Shared axis names (pump/exit direction)
  'builder.axis.pressure': 'Druck',
  'builder.axis.flow': 'Durchfluss',
  'builder.common.max': 'Max.',

  // Target chart
  'builder.chart.preview': 'Vorschau der Profilziele',
  'builder.chart.svgLabel': 'Ziel für Durchfluss, Druck und Temperatur über die Profilphasen',

  // Segmented controls
  'builder.segment.stageControl': 'Phasensteuerung',
  'builder.transition.groupLabel': 'Phasenübergang',
  'builder.transition.fast': 'Schnell',
  'builder.transition.smooth': 'Sanft',
  'builder.sensor.groupLabel': 'Temperatursensor',
  'builder.sensor.coffee': 'Kaffee',
  'builder.sensor.water': 'Wasser',

  // Stepper accessibility
  'builder.stepper.valueLabel': '{label}, {value} {unit}',
  'builder.stepper.decreaseLabel': '{label} verringern; halten für ganze Einheiten',
  'builder.stepper.openFullscreenLabel': '{label} im Vollbild anpassen',
  'builder.stepper.increaseLabel': '{label} erhöhen; halten für ganze Einheiten',

  // Move-on (exit) condition control
  'builder.exit.moveOnPressure': 'Weiter bei Druck',
  'builder.exit.moveOnFlow': 'Weiter bei Durchfluss',
  'builder.exit.moveOnPressureConditionLabel': 'Bedingung „Weiter bei Druck“',
  'builder.exit.moveOnFlowConditionLabel': 'Bedingung „Weiter bei Durchfluss“',

  // Stage card
  'builder.stage.dragHandle': 'Ziehen, um die Phase neu anzuordnen',
  'builder.stage.maxFlowLabel': 'Max. Durchfluss',
  'builder.stage.maxPressureLabel': 'Max. Druck',
  'builder.stage.maxTimeLabel': 'Max. Zeit',
  'builder.stage.moveOnVolumeLabel': 'Weiter bei Volumen',
  'builder.stage.moveOnYieldLabel': 'Weiter bei Menge',
  'builder.stage.secondsMax': 'max. {value} s',
  'builder.stage.weightAtLeast': 'Gewicht ≥ {value} g',
  'builder.stage.volumeAtLeast': 'Volumen ≥ {value} ml',
  'builder.stage.openLabel': 'Phase {n} öffnen: {name}',
  'builder.stage.pressureTargetLabel': 'Zieldruck',
  'builder.stage.flowTargetLabel': 'Zieldurchfluss',
  'builder.stage.pressureTargetAriaLabel': 'Zieldruck',
  'builder.stage.flowTargetAriaLabel': 'Zieldurchfluss',
  'builder.stage.waterTemperatureLabel': 'Wassertemperatur',
  'builder.stage.coffeeTemperatureLabel': 'Kaffeetemperatur',
  'builder.stage.movesOnSummary': 'Geht weiter, sobald eine Bedingung erfüllt ist',
  'builder.stage.activeLabel': 'Phase {n}: {name}',
  'builder.stage.nameFieldLabel': 'Name der Phase {n}',
  'builder.stage.tabsLabel': 'Phaseneinstellungen',
  'builder.stage.moveOnTab': 'Weiter, wenn',
  'builder.stage.duplicateLabel': 'Phase {n} duplizieren',
  'builder.stage.deleteLabel': 'Phase {n} löschen',
  'builder.stage.targetPanelLabel': 'Zielsteuerung',
  'builder.stage.transitionLabel': 'Übergang',
  'builder.stage.measureFromLabel': 'Messen ab',
  'builder.stage.conditionsPanelLabel': 'Weiter-Bedingungen',
  'builder.stage.conditionsHint': 'Die nächste Phase beginnt, sobald eine der Bedingungen links erfüllt ist.',
  'builder.stage.stripLabel': 'Bearbeitbare Brühphasen',
  'builder.stage.addStage': 'Phase hinzufügen',
  'builder.stage.numberLabel': 'Phase {n}',

  // Profile topbar
  'builder.profile.closeMoreSettings': 'Weitere Einstellungen schließen',
  'builder.profile.nameLabel': 'Profilname',
  'builder.profile.categoryLabel': 'Kategorie',
  'builder.profile.categoryPlaceholder': 'Kategorie wählen (optional)',
  'builder.profile.uncategorized': 'Ohne Kategorie',
  'builder.profile.lessSettings': 'Weniger Einstellungen',
  'builder.profile.moreSettings': 'Weitere Einstellungen',
  'builder.profile.typeLabel': 'Typ',
  'builder.profile.endShotYield': 'Endmenge',
  'builder.profile.saveFailed': 'Dieses Profil konnte nicht gespeichert werden.',

  // Actions
  'builder.actions.cancel': 'Abbrechen',
  'builder.actions.saving': 'Speichert…',
  'builder.actions.save': 'Speichern',
  'builder.actions.saveAnyway': 'Trotzdem speichern',

  // Beverage type (display only; stored value stays the internal enum)
  'builder.beverageType.espresso': 'Espresso',
  'builder.beverageType.pourover': 'Pour-over',
  'builder.beverageType.manual': 'Manuell',
  'builder.beverageType.cleaning': 'Reinigung',
  'builder.beverageType.calibrate': 'Kalibrieren',

  // Validation panel
  'builder.validation.panelLabel': 'Profilprüfung',
  'builder.validation.needsAttention': 'Profil braucht Aufmerksamkeit',
  'builder.validation.reviewBeforeSaving': 'Vor dem Speichern prüfen',
  'builder.validation.closeLabel': 'Prüfung schließen',
  'builder.validation.profileLabel': 'Profil',
  'builder.validation.allValid': 'Alle erforderlichen Profildaten sind gültig.',

  // Profile details panel
  'builder.details.panelLabel': 'Profildetails und erweiterte Einstellungen',
  'builder.details.versionLabel': 'Profilversion',
  'builder.details.versionPlaceholder': 'Version wählen oder eingeben',
  'builder.details.endShotVolumeLabel': 'Endvolumen (ohne Waage)',
  'builder.details.endShotVolumeFallbackLabel': 'Ersatz-Endvolumen',
  'builder.details.flowToleranceLabel': 'Durchflussbegrenzer-Reaktionsbereich',
  'builder.details.pressureToleranceLabel': 'Druckbegrenzer-Reaktionsbereich',
  'builder.details.volumeStartLabel': 'Volumenmessung starten ab',
  'builder.details.chooseStage': 'Phase wählen',
  'builder.details.authorLabel': 'Autor',
  'builder.details.authorPlaceholder': 'Dein Decent-Benutzername oder „user“',
  'builder.details.authorHint': 'Wird beim Speichern aus dem angemeldeten Konto übernommen.',
  'builder.details.descriptionLabel': 'Beschreibung',
  'builder.details.descriptionPlaceholder': 'Beschreibe, wie dieses Profil brüht',

  // Discard confirmation
  'builder.discard.title': 'Profiländerungen verwerfen?',
  'builder.discard.body': 'Deine ungespeicherten Änderungen gehen verloren.',
  'builder.discard.keepEditing': 'Weiter bearbeiten',
  'builder.discard.discard': 'Verwerfen',

  // Validation messages: generic field templates
  'builder.validation.mustBeNumber': '{label} muss eine Zahl sein.',
  'builder.validation.mustBeBetween': '{label} muss zwischen {min} und {max} liegen.',
  'builder.validation.label.pressureTarget': 'Zieldruck',
  'builder.validation.label.flowTarget': 'Zieldurchfluss',
  'builder.validation.label.maximumTime': 'Max. Zeit',
  'builder.validation.label.stageVolume': 'Phasenvolumen',
  'builder.validation.label.moveOnThreshold': 'Schwellenwert',
  'builder.validation.label.limiterValue': 'Begrenzerwert',
  'builder.validation.label.limiterResponseRange': 'Begrenzer-Reaktionsbereich',

  // Validation messages: generated-profile schema check
  'builder.validation.schema.noName': 'Das generierte Profil hat keinen Namen.',
  'builder.validation.schema.noStages': 'Das generierte Profil hat keine Phasen.',
  'builder.validation.schema.volumeStartNotInteger': 'Der generierte Startwert für die Volumenzählung ist keine ganze Zahl.',
  'builder.validation.schema.tankTemperatureInvalid': 'Die generierte Tanktemperatur ist ungültig.',
  'builder.validation.schema.invalidStage': 'Das generierte Profil enthält eine ungültige Phase.',
  'builder.validation.schema.unsupportedPump': 'Das generierte Profil enthält einen nicht unterstützten Pumpenmodus.',
  'builder.validation.schema.unsupportedTransition': 'Das generierte Profil enthält einen nicht unterstützten Übergang.',
  'builder.validation.schema.unsupportedSensor': 'Das generierte Profil enthält einen nicht unterstützten Temperatursensor.',
  'builder.validation.schema.missingStageValue': 'Dem generierten Profil fehlt ein Phasenwert.',
  'builder.validation.schema.missingAxisTarget': 'Dem generierten Profil fehlt das Ziel der gesteuerten Achse.',
  'builder.validation.schema.invalidMoveOn': 'Das generierte Profil enthält eine ungültige „Weiter, wenn“-Bedingung.',
  'builder.validation.schema.invalidLimiter': 'Das generierte Profil enthält einen ungültigen Begrenzer.',
  'builder.validation.schema.roundTripChanged': 'Das Profil kann nicht verlustfrei hin- und zurückkonvertiert werden.',
  'builder.validation.schema.notEncodable': 'Das Profil kann nicht als Decaid-kompatibles JSON kodiert werden.',

  // Validation messages: profile-level
  'builder.validation.profile.titleRequired': 'Gib einen Profilnamen ein.',
  'builder.validation.profile.stagesRequired': 'Füge mindestens eine Brühphase hinzu.',
  'builder.validation.profile.maxStages': 'Decent-Profile unterstützen bis zu {max} Phasen.',
  'builder.validation.profile.beverageType': 'Wähle eine unterstützte Getränkeart.',
  'builder.validation.profile.tankTemperatureNumber': 'Die Tanktemperatur muss eine Zahl sein.',
  'builder.validation.profile.volumeStartWhole': 'Der Startwert für die Volumenzählung muss eine ganze Phasennummer sein.',
  'builder.validation.profile.targetWeightRange': 'Die Endmenge muss zwischen 0 und {max} g liegen.',
  'builder.validation.profile.targetVolumeRange': 'Das Ersatz-Endvolumen muss zwischen 0 und {max} ml liegen.',
  'builder.validation.profile.volumeStartRange': 'Wähle, ab welcher Phase die Volumenmessung beginnt. Die zuvor gewählte Phase gibt es nicht mehr.',
  'builder.validation.profile.noFinalTarget': 'Es ist keine Abschlussmenge festgelegt. Dieses Rezept läuft bis zum Ende seiner Phasen oder bis du es manuell stoppst.',
  'builder.validation.profile.conversionFailed': 'Das Profil kann nicht in das Decaid-Format umgewandelt werden, ohne dass sich seine Daten ändern.',

  // Validation messages: stage-level
  'builder.validation.stage.nameEmpty': 'Benenne diese Phase. Ein kurzer Name macht sie leichter wiedererkennbar.',
  'builder.validation.stage.pumpRequired': 'Wähle Druck- oder Durchflusssteuerung.',
  'builder.validation.stage.transitionRequired': 'Wähle einen schnellen oder sanften Übergang.',
  'builder.validation.stage.sensorRequired': 'Wähle den Kaffee- oder Wassertemperatursensor.',
  'builder.validation.stage.exitTypeRequired': 'Wähle eine Druck- oder Durchfluss-Bedingung für „Weiter, wenn“.',
  'builder.validation.stage.exitConditionRequired': 'Wähle, ob der Messwert über oder unter dem Schwellenwert liegen muss.',
  'builder.validation.stage.exitBeyondLimiter': 'Eine „Weiter, wenn“-Bedingung funktioniert möglicherweise nicht. {axis} ist auf {limiterValue} begrenzt, sodass „über {exitValue}“ wahrscheinlich nicht erreicht wird. Diese Phase geht trotzdem nach {duration} weiter oder wenn eine andere Bedingung erfüllt ist.',
  'builder.validation.stage.exitAlreadyMet': 'Diese Phase wird möglicherweise übersprungen. Sie beginnt voraussichtlich bei etwa {value}, was die „Weiter, wenn“-Bedingung bereits erfüllt.',
  'builder.validation.stage.limiterMismatchPressureStage': 'Eine druckgesteuerte Phase kann nur den Durchfluss begrenzen.',
  'builder.validation.stage.limiterMismatchFlowStage': 'Eine durchflussgesteuerte Phase kann nur den Druck begrenzen.',

  'builder.validation.readyToSave': 'Bereit zum Speichern',

  // Import (Decaid -> draft) messages
  'builder.import.stageTargetNumber': 'Das Phasenziel muss eine Zahl sein.',
  'builder.import.temperatureNumber': 'Temperatur muss eine Zahl sein.',
  'builder.import.secondsNumber': 'Sekunden müssen eine Zahl sein.',
  'builder.import.volumeNumber': 'Volumen muss eine Zahl sein.',
  'builder.import.exitTypeUnsupported': 'Wähle eine unterstützte Druck- oder Durchfluss-Bedingung für „Weiter, wenn“.',
  'builder.import.exitConditionUnsupported': 'Wähle, ob der „Weiter, wenn“-Wert über oder unter dem Schwellenwert liegen muss.',
  'builder.import.exitThresholdNumber': 'Der Schwellenwert für „Weiter, wenn“ muss eine Zahl sein.',
  'builder.import.limiterValueNumber': 'Der Begrenzerwert muss eine Zahl sein.',
  'builder.import.limiterRangeRequired': 'Der Begrenzer-Reaktionsbereich ist erforderlich und muss eine Zahl sein.',
  'builder.import.volumeCountStartRequired': 'Der Startwert für die Volumenzählung ist erforderlich und muss eine Zahl sein.',
  'builder.import.tankTemperatureRequired': 'Die Tanktemperatur ist erforderlich und muss eine Zahl sein.',

  // Plurals
  'builder.validation.issueCount': { one: '{count} Profilproblem', other: '{count} Profilprobleme' },
  'builder.validation.stageSeconds': { one: '{count} Sekunde', other: '{count} Sekunden' },
  'builder.validation.errorCount': { one: '{count} Fehler', other: '{count} Fehler' },
  'builder.validation.warningCount': { one: '{count} Warnung', other: '{count} Warnungen' },
} satisfies Translation<typeof builderEn>
