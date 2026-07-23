# UCU BEDEN Graph Preview

Legend: observed = direct code/workflow evidence, inferred = probable runtime relation, planned = not implemented yet, broken = missing endpoint.

Scheduler
|-- daily-poem-and-deploy.yml
|   |-- npm script for backfillVisuals.ts [observed, 96%]
|   |-- npm run build [observed, 96%]
|   |-- npm script for generateDailyPoem.ts [observed, 96%]
|-- night-dream-and-deploy.yml
|   |-- npm script for backfillVisuals.ts [observed, 96%]
|   |-- npm run build [observed, 96%]
|   |-- npm script for generateDream.ts [observed, 96%]
|-- pr-check.yml
|   |-- npm run build [observed, 96%]
|   |-- npm run typecheck [observed, 96%]

Daily Generation
|-- npm script for generateDailyPoem.ts
|   |-- calls_process: analyzeAndSaveInputPoems [observed, 86%]
|   |-- calls_process: analyzeRepetitionPressure [observed, 86%]
|   |-- calls_process: buildMemoryArchive [observed, 86%]
|   |-- calls_process: calculateMood [observed, 86%]
|   |-- calls_process: collectSources [observed, 86%]
|   |-- calls_process: createDailyLife [observed, 86%]
|   |-- calls_process: createDailyLifeRecord [observed, 86%]
|   |-- calls_process: createPoemVisual [observed, 86%]
|   |-- calls_process: createWalkState [observed, 86%]
|   |-- calls_process: ensureSourceDigest [observed, 86%]
|   |-- calls_process: formatAge [observed, 86%]
|   |-- calls_process: generatePoemWithLLM [observed, 86%]
|   |-- calls_process: generateVisualImage [observed, 86%]
|   |-- calls_process: maybeCreateYearlyReport [observed, 86%]
|   |-- calls_process: nextAgeMonths [observed, 86%]
|   |-- calls_process: parseGenerationArgs [observed, 86%]
|   |-- calls_process: reconcileVisualImagePath [observed, 86%]
|   |-- calls_process: selectMemoryForGeneration [observed, 86%]
|   |-- calls_process: selectMemoryFragments [observed, 86%]
|   |-- calls_process: todayInIstanbul [observed, 86%]
|   |-- calls_process: updateMemoryAfterPoem [observed, 86%]
|   |-- calls_process: validateMemoryPromptFragments [observed, 86%]
|   |-- ... 16 more edges

Dream Generation
|-- npm script for generateDream.ts
|   |-- calls_process: analyzeRepetitionPressure [observed, 86%]
|   |-- calls_process: buildMemoryArchive [observed, 86%]
|   |-- calls_process: createDailyLifeRecord [observed, 86%]
|   |-- calls_process: createDreamVisual [observed, 86%]
|   |-- calls_process: generateDream [observed, 86%]
|   |-- calls_process: generateVisualImage [observed, 86%]
|   |-- calls_process: parseGenerationArgs [observed, 86%]
|   |-- calls_process: reconcileVisualImagePath [observed, 86%]
|   |-- calls_process: selectMemoryForGeneration [observed, 86%]
|   |-- calls_process: todayInIstanbul [observed, 86%]
|   |-- calls_process: validateMemoryPromptFragments [observed, 86%]
|   |-- calls_process: visualImageStatus [observed, 86%]
|   |-- calls_process: writeMemoryArchive [observed, 86%]
|   |-- reads: data/daily_life [observed, 90%]
|   |-- reads: data/dreams [observed, 82%]
|   |-- reads: data/generated_poems [observed, 88%]
|   |-- reads: data/settings/personality_settings.json [observed, 90%]
|   |-- reads: data/source_digests [observed, 90%]
|   |-- reads: data/state/ucu_beden_state.json [observed, 90%]
|   |-- reads: data/visuals [observed, 82%]
|   |-- uses_database: JSON filesystem storage [observed, 82%]
|   |-- writes: data/daily_life [observed, 88%]
|   |-- ... 6 more edges

Visual Backfill
|-- npm script for backfillVisuals.ts
|   |-- calls_process: createDreamVisual [observed, 86%]
|   |-- calls_process: createPoemVisual [observed, 86%]
|   |-- calls_process: generateVisualImage [observed, 86%]
|   |-- calls_process: reconcileVisualImagePath [observed, 86%]
|   |-- calls_process: todayInIstanbul [observed, 86%]
|   |-- calls_process: visualImageIsUsable [observed, 86%]
|   |-- reads: data/dreams [observed, 90%]
|   |-- reads: data/generated_poems [observed, 90%]
|   |-- reads: data/visuals [observed, 82%]
|   |-- uses_database: JSON filesystem storage [observed, 82%]
|   |-- writes: data/dreams [observed, 88%]
|   |-- writes: data/visuals [observed, 86%]

Source Digest
|-- npm script for digestSources.ts
|   |-- calls_process: ensureSourceDigest [observed, 86%]
|   |-- calls_process: todayInIstanbul [observed, 86%]
|   |-- reads: data/sources [observed, 88%]
|   |-- uses_database: JSON filesystem storage [observed, 82%]

Memory Rebuild
|-- npm script for rebuildMemory.ts
|   |-- calls_process: addCalendarDays [observed, 86%]
|   |-- calls_process: analyzeRepetitionPressure [observed, 86%]
|   |-- calls_process: analyzeSourceDigest [observed, 86%]
|   |-- calls_process: buildMemoryArchive [observed, 86%]
|   |-- calls_process: buildMemoryGraphData [observed, 86%]
|   |-- calls_process: memoryArchiveStateSignature [observed, 86%]
|   |-- calls_process: selectMemoryForGeneration [observed, 86%]
|   |-- calls_process: todayInIstanbul [observed, 86%]
|   |-- calls_process: validateMemoryArchive [observed, 86%]
|   |-- calls_process: validateMemoryCycleIntegrity [observed, 86%]
|   |-- calls_process: validateMemoryPromptFragments [observed, 86%]
|   |-- calls_process: validateSourceDigests [observed, 86%]
|   |-- calls_process: validateSourceInfluence [observed, 86%]
|   |-- calls_process: validateStoredLanguageRecords [observed, 86%]
|   |-- calls_process: validateStoredSurfaceRecords [observed, 86%]
|   |-- calls_process: writeMemoryArchive [observed, 86%]
|   |-- reads: data/dreams [observed, 90%]
|   |-- reads: data/generated_poems [observed, 90%]
|   |-- reads: data/source_digests [observed, 90%]
|   |-- reads: data/sources [observed, 90%]
|   |-- reads: data/world/ucu_beden_world.json [observed, 90%]
|   |-- uses_database: JSON filesystem storage [observed, 82%]
|   |-- ... 3 more edges

Gmail
|-- Gmail intake [orphan source, 0% output influence]
|   |-- no observed reader script
|   |-- no observed storage output
|   |-- no observed memory consumer

Alerts
|-- info: gmail_not_observed - Gmail node has no observed repo implementation
|-- warning: missing_source_digests - Some source bundles do not have public source digests
|-- warning: visual_output_not_linked_to_memory_traces - Visual outputs are present but visual memory traces are empty
|-- info: possibly_unused_output - Produced output has no observed reader: data/analysis/vocabulary_memory.json

