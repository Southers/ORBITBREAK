const StoragePrefix = 'orbitbreak.personal-best';

function isValidRunResult(Result) {
  return Result
    && typeof Result.systemIdentifier === 'string'
    && typeof Result.contentVersion === 'string'
    && Result.assistState === 'ranked'
    && Number.isInteger(Result.score)
    && Result.score >= 0
    && Number.isInteger(Result.launchesUsed)
    && Result.launchesUsed >= 0
    && Number.isInteger(Result.flightTimeMilliseconds)
    && Result.flightTimeMilliseconds >= 0;
}

export function createRunResult({
  systemIdentifier,
  contentVersion,
  score,
  launchesUsed,
  flightTimeMilliseconds,
  assistState = 'ranked',
}) {
  const Result = {
    systemIdentifier,
    contentVersion,
    assistState,
    score,
    launchesUsed,
    flightTimeMilliseconds,
  };
  if (!isValidRunResult(Result)) {
    throw new Error('Completed run result is invalid.');
  }
  return Result;
}

/** Positive means Candidate outranks Incumbent. */
export function compareRunResults(Candidate, Incumbent) {
  if (Candidate.score !== Incumbent.score) {
    return Candidate.score - Incumbent.score;
  }
  if (Candidate.launchesUsed !== Incumbent.launchesUsed) {
    return Incumbent.launchesUsed - Candidate.launchesUsed;
  }
  return Incumbent.flightTimeMilliseconds - Candidate.flightTimeMilliseconds;
}

export function getPersonalBestStorageKey(SystemIdentifier, ContentVersion) {
  return `${StoragePrefix}.${SystemIdentifier}.${ContentVersion}`;
}

export function loadPersonalBest(Storage, SystemIdentifier, ContentVersion) {
  const SerializedResult = Storage.getItem(
    getPersonalBestStorageKey(SystemIdentifier, ContentVersion),
  );
  if (!SerializedResult) {
    return null;
  }
  try {
    const Result = JSON.parse(SerializedResult);
    return isValidRunResult(Result)
      && Result.systemIdentifier === SystemIdentifier
      && Result.contentVersion === ContentVersion
      ? Result
      : null;
  } catch {
    return null;
  }
}

export function savePersonalBest(Storage, Candidate) {
  const PreviousPersonalBest = loadPersonalBest(
    Storage,
    Candidate.systemIdentifier,
    Candidate.contentVersion,
  );
  const IsNewPersonalBest = PreviousPersonalBest === null
    || compareRunResults(Candidate, PreviousPersonalBest) > 0;
  const PersonalBest = IsNewPersonalBest ? Candidate : PreviousPersonalBest;
  if (IsNewPersonalBest) {
    Storage.setItem(
      getPersonalBestStorageKey(Candidate.systemIdentifier, Candidate.contentVersion),
      JSON.stringify(Candidate),
    );
  }
  return {
    personalBest: PersonalBest,
    previousPersonalBest: PreviousPersonalBest,
    isNewPersonalBest: IsNewPersonalBest,
  };
}
