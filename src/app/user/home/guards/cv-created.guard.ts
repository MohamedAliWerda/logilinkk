import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CvSubmissionService } from '../component/cv-ats/cv-submission.service';

export const cvCreatedGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const cvSubmissionService = inject(CvSubmissionService);

  // Fast path: if we already know this user has a CV, allow instantly.
  if (cvSubmissionService.hasCachedCv()) {
    return true;
  }

  try {
    const cv = await cvSubmissionService.fetchMyCv();
    if (cv) {
      return true;
    }
    return router.createUrlTree(['/home/cv-landing']);
  } catch (err) {
    // Expired/invalid auth should return to login, not CV onboarding.
    if (cvSubmissionService.isAuthRequiredError(err)) {
      return router.createUrlTree(['/login']);
    }

    // If backend check fails transiently, trust recent known CV state.
    if (cvSubmissionService.hasCachedCv()) {
      return true;
    }
  }

  return router.createUrlTree(['/home/cv-landing']);
};