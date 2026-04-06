import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CvSubmissionService } from '../component/cv-ats/cv-submission.service';

export const cvCreatedGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const cvSubmissionService = inject(CvSubmissionService);

  try {
    const cv = await cvSubmissionService.fetchMyCv();
    if (cv) {
      return true;
    }
  } catch {
    // If CV check fails, keep user in the onboarding path.
  }

  return router.createUrlTree(['/home/cv-landing']);
};