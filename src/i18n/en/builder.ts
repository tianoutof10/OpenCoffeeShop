/** Profile builder: stage editor, target chart, validation panel, and profile metadata form. */
export const builderEn = {
  'builder.details.limiterRangeHint': 'Controls the limiter’s response around its limit.',
  // Shared axis names (pump/exit direction)
  'builder.axis.pressure': 'Pressure',
  'builder.axis.flow': 'Flow',
  'builder.common.max': 'Max',

  // Target chart
  'builder.chart.preview': 'Profile target preview',
  'builder.chart.svgLabel': 'Flow, pressure, and temperature targets across the profile stages',

  // Segmented controls
  'builder.segment.stageControl': 'Stage control',
  'builder.transition.groupLabel': 'Stage transition',
  'builder.transition.fast': 'Fast',
  'builder.transition.smooth': 'Smooth',
  'builder.sensor.groupLabel': 'Temperature sensor',
  'builder.sensor.coffee': 'Coffee',
  'builder.sensor.water': 'Water',

  // Stepper accessibility
  'builder.stepper.valueLabel': '{label}, {value} {unit}',
  'builder.stepper.decreaseLabel': 'Reduce {label}; hold for whole units',
  'builder.stepper.openFullscreenLabel': 'Open {label} fullscreen adjustment',
  'builder.stepper.increaseLabel': 'Increase {label}; hold for whole units',

  // Move-on (exit) condition control
  'builder.exit.moveOnPressure': 'Move on pressure',
  'builder.exit.moveOnFlow': 'Move on flow',
  'builder.exit.moveOnPressureConditionLabel': 'Move on pressure condition',
  'builder.exit.moveOnFlowConditionLabel': 'Move on flow condition',

  // Stage card
  'builder.stage.dragHandle': 'Drag to reorder stage',
  'builder.stage.maxFlowLabel': 'Max flow',
  'builder.stage.maxPressureLabel': 'Max pressure',
  'builder.stage.maxTimeLabel': 'Max time',
  'builder.stage.moveOnVolumeLabel': 'Move on volume',
  'builder.stage.moveOnYieldLabel': 'Move on yield',
  'builder.stage.secondsMax': '{value}s max',
  'builder.stage.weightAtLeast': 'Weight ≥ {value} g',
  'builder.stage.volumeAtLeast': 'Volume ≥ {value} ml',
  'builder.stage.openLabel': 'Open stage {n}: {name}',
  'builder.stage.pressureTargetLabel': 'Pressure Target',
  'builder.stage.flowTargetLabel': 'Flow Target',
  'builder.stage.pressureTargetAriaLabel': 'pressure target',
  'builder.stage.flowTargetAriaLabel': 'flow target',
  'builder.stage.waterTemperatureLabel': 'Water temperature',
  'builder.stage.coffeeTemperatureLabel': 'Coffee temperature',
  'builder.stage.movesOnSummary': 'Moves on when any is reached',
  'builder.stage.activeLabel': 'Stage {n}: {name}',
  'builder.stage.nameFieldLabel': 'Stage {n} name',
  'builder.stage.tabsLabel': 'Stage settings',
  'builder.stage.moveOnTab': 'Move on',
  'builder.stage.duplicateLabel': 'Duplicate stage {n}',
  'builder.stage.deleteLabel': 'Delete stage {n}',
  'builder.stage.targetPanelLabel': 'Target controls',
  'builder.stage.transitionLabel': 'Transition',
  'builder.stage.measureFromLabel': 'Measure from',
  'builder.stage.conditionsPanelLabel': 'Move on conditions',
  'builder.stage.conditionsHint': 'The next stage starts as soon as any condition on the left is met.',
  'builder.stage.stripLabel': 'Editable brew stages',
  'builder.stage.addStage': 'Add stage',
  'builder.stage.numberLabel': 'Stage {n}',

  // Profile topbar
  'builder.profile.closeMoreSettings': 'Close more settings',
  'builder.profile.nameLabel': 'Profile name',
  'builder.profile.categoryLabel': 'Category',
  'builder.profile.categoryPlaceholder': 'Choose category (optional)',
  'builder.profile.uncategorized': 'Uncategorized',
  'builder.profile.lessSettings': 'Less settings',
  'builder.profile.moreSettings': 'More settings',
  'builder.profile.typeLabel': 'Type',
  'builder.profile.endShotYield': 'End shot yield',
  'builder.profile.saveFailed': 'This profile could not be saved.',

  // Actions
  'builder.actions.cancel': 'Cancel',
  'builder.actions.saving': 'Saving…',
  'builder.actions.save': 'Save',
  'builder.actions.saveAnyway': 'Save anyway',

  // Beverage type (display only; stored value stays the internal enum)
  'builder.beverageType.espresso': 'Espresso',
  'builder.beverageType.pourover': 'Pour over',
  'builder.beverageType.manual': 'Manual',
  'builder.beverageType.cleaning': 'Cleaning',
  'builder.beverageType.calibrate': 'Calibrate',

  // Validation panel
  'builder.validation.panelLabel': 'Profile validation',
  'builder.validation.needsAttention': 'Profile needs attention',
  'builder.validation.reviewBeforeSaving': 'Review before saving',
  'builder.validation.closeLabel': 'Close validation',
  'builder.validation.profileLabel': 'Profile',
  'builder.validation.allValid': 'All required profile data is valid.',

  // Profile details panel
  'builder.details.panelLabel': 'Profile details and advanced settings',
  'builder.details.versionLabel': 'Profile version',
  'builder.details.versionPlaceholder': 'Choose or enter a version',
  'builder.details.endShotVolumeLabel': 'End shot volume (without scale)',
  'builder.details.endShotVolumeFallbackLabel': 'End shot volume fallback',
  'builder.details.flowToleranceLabel': 'Flow limiter range',
  'builder.details.pressureToleranceLabel': 'Pressure limiter range',
  'builder.details.volumeStartLabel': 'Start measuring volume from',
  'builder.details.chooseStage': 'Choose a stage',
  'builder.details.authorLabel': 'Author',
  'builder.details.authorPlaceholder': 'Your Decent username, or user',
  'builder.details.authorHint': 'Set from the signed-in account when saved.',
  'builder.details.descriptionLabel': 'Description',
  'builder.details.descriptionPlaceholder': 'Describe how this profile brews',

  // Discard confirmation
  'builder.discard.title': 'Discard profile changes?',
  'builder.discard.body': 'Your unsaved changes will be lost.',
  'builder.discard.keepEditing': 'Keep editing',
  'builder.discard.discard': 'Discard',

  // Validation messages: generic field templates
  'builder.validation.mustBeNumber': '{label} must be a number.',
  'builder.validation.mustBeBetween': '{label} must be between {min} and {max}.',
  'builder.validation.label.pressureTarget': 'Pressure target',
  'builder.validation.label.flowTarget': 'Flow target',
  'builder.validation.label.maximumTime': 'Maximum time',
  'builder.validation.label.stageVolume': 'Stage volume',
  'builder.validation.label.moveOnThreshold': 'Move-on threshold',
  'builder.validation.label.limiterValue': 'Limiter value',
  'builder.validation.label.limiterResponseRange': 'Limiter response range',

  // Validation messages: generated-profile schema check
  'builder.validation.schema.noName': 'The generated profile has no name.',
  'builder.validation.schema.noStages': 'The generated profile has no stages.',
  'builder.validation.schema.volumeStartNotInteger': 'The generated volume-count start is not an integer.',
  'builder.validation.schema.tankTemperatureInvalid': 'The generated tank temperature is invalid.',
  'builder.validation.schema.invalidStage': 'The generated profile contains an invalid stage.',
  'builder.validation.schema.unsupportedPump': 'The generated profile contains an unsupported pump mode.',
  'builder.validation.schema.unsupportedTransition': 'The generated profile contains an unsupported transition.',
  'builder.validation.schema.unsupportedSensor': 'The generated profile contains an unsupported temperature sensor.',
  'builder.validation.schema.missingStageValue': 'The generated profile contains a missing stage value.',
  'builder.validation.schema.missingAxisTarget': 'The generated profile is missing its controlled-axis target.',
  'builder.validation.schema.invalidMoveOn': 'The generated profile contains an invalid move-on condition.',
  'builder.validation.schema.invalidLimiter': 'The generated profile contains an invalid limiter.',
  'builder.validation.schema.roundTripChanged': 'The profile cannot be round-tripped without changing its data.',
  'builder.validation.schema.notEncodable': 'The profile cannot be encoded as Decaid-compatible JSON.',

  // Validation messages: profile-level
  'builder.validation.profile.titleRequired': 'Enter a profile name.',
  'builder.validation.profile.stagesRequired': 'Add at least one brew stage.',
  'builder.validation.profile.maxStages': 'Decent profiles support up to {max} stages.',
  'builder.validation.profile.beverageType': 'Choose a supported beverage type.',
  'builder.validation.profile.tankTemperatureNumber': 'Tank temperature must be a number.',
  'builder.validation.profile.volumeStartWhole': 'Volume count start must be a whole stage number.',
  'builder.validation.profile.targetWeightRange': 'End shot yield must be between 0 and {max} g.',
  'builder.validation.profile.targetVolumeRange': 'End shot volume fallback must be between 0 and {max} ml.',
  'builder.validation.profile.volumeStartRange': 'Choose where volume measurement starts. The previously selected step no longer exists.',
  'builder.validation.profile.noFinalTarget': 'No final stop amount is set. This recipe will finish through its steps, or when you stop it manually.',
  'builder.validation.profile.conversionFailed': 'The profile cannot be converted to Decaid format without changing its data.',

  // Validation messages: stage-level
  'builder.validation.stage.nameEmpty': 'Name this step. A short name will make it easier to recognise.',
  'builder.validation.stage.pumpRequired': 'Choose pressure or flow control.',
  'builder.validation.stage.transitionRequired': 'Choose a fast or smooth transition.',
  'builder.validation.stage.sensorRequired': 'Choose the coffee or water temperature sensor.',
  'builder.validation.stage.exitTypeRequired': 'Choose a pressure or flow move-on condition.',
  'builder.validation.stage.exitConditionRequired': 'Choose whether the reading moves over or under the threshold.',
  'builder.validation.stage.exitBeyondLimiter': 'One move-on condition may not work. {axis} is limited to {limiterValue}, so “above {exitValue}” probably won\'t be reached. This step will still move on after {duration} or when another condition is met.',
  'builder.validation.stage.exitAlreadyMet': 'This step may be skipped. It may begin around {value}, which already meets the move-on condition.',
  'builder.validation.stage.limiterMismatchPressureStage': 'A pressure-controlled stage can only limit flow.',
  'builder.validation.stage.limiterMismatchFlowStage': 'A flow-controlled stage can only limit pressure.',

  'builder.validation.readyToSave': 'Ready to save',

  // Import (Decaid -> draft) messages
  'builder.import.stageTargetNumber': 'The stage target must be a number.',
  'builder.import.temperatureNumber': 'Temperature must be a number.',
  'builder.import.secondsNumber': 'Seconds must be a number.',
  'builder.import.volumeNumber': 'Volume must be a number.',
  'builder.import.exitTypeUnsupported': 'Choose a supported pressure or flow move-on condition.',
  'builder.import.exitConditionUnsupported': 'Choose whether the move-on value is over or under the threshold.',
  'builder.import.exitThresholdNumber': 'The move-on threshold must be a number.',
  'builder.import.limiterValueNumber': 'The limiter value must be a number.',
  'builder.import.limiterRangeRequired': 'The limiter response range is required and must be a number.',
  'builder.import.volumeCountStartRequired': 'Volume count start is required and must be a number.',
  'builder.import.tankTemperatureRequired': 'Tank temperature is required and must be a number.',

  // Plurals
  'builder.validation.issueCount': { one: '{count} profile issue', other: '{count} profile issues' },
  'builder.validation.stageSeconds': { one: '{count} second', other: '{count} seconds' },
  'builder.validation.errorCount': { one: '{count} error', other: '{count} errors' },
  'builder.validation.warningCount': { one: '{count} warning', other: '{count} warnings' },
} as const
