'use server';

import { getSubmissionTimeline, getSubmissionDetails } from '../../../lib/data/submissions';

export async function fetchSubmissionTimelineAction(submissionId: string) {
  try {
    const data = await getSubmissionTimeline(submissionId);
    return JSON.parse(JSON.stringify(data));
  } catch (e: any) {
    throw new Error(e.message || 'Failed to fetch timeline');
  }
}

export async function fetchSubmissionDetailsAction(submissionId: string) {
  try {
    const data = await getSubmissionDetails(submissionId);
    return JSON.parse(JSON.stringify(data));
  } catch (e: any) {
    throw new Error(e.message || 'Failed to fetch details');
  }
}
