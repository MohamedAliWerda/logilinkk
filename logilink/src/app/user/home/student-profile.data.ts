export type ProfileInfoItem = {
  label: string;
  value: string;
};

export type ProfileInfoGroup = {
  title: string;
  items: readonly ProfileInfoItem[];
};

export type StudentProfileData = {
  readonly displayName: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly status: string;
  readonly summaryItems: readonly ProfileInfoItem[];
  readonly infoSectionTitle: string;
  readonly infoSectionSubtitle: string;
  readonly infoGroups: readonly ProfileInfoGroup[];
};

export const STUDENT_PROFILE_DATA: StudentProfileData = {
  displayName: 'Ahmed Ben Ali',
  firstName: 'Ahmed',
  lastName: 'Ben Ali',
  status: 'Etudiant actif',
  summaryItems: [
    {
      label: 'Groupe',
      value: '3-GL-LI-G1-M1',
    },
    {
      label: 'Niveau',
      value: '3',
    },
    {
      label: 'Filiere',
      value: 'Licence Nationale en Genie Logistique: Logistique Industrielle',
    },
    {
      label: 'Departement',
      value: 'Technologies',
    },
  ],
  infoSectionTitle: 'Informations personnelles',
  infoSectionSubtitle:
    'Retrouvez vos informations generales, de localisation et de contact.',
  infoGroups: [
    {
      title: 'Informations generales',
      items: [
        {
          label: 'Nom & Prenom',
          value: 'ahmrd ben ali',
        },
        {
          label: 'Sexe',
          value: 'Masculin',
        },
        {
          label: 'CIN / Passport',
          value: '11111111',
        },
        {
          label: 'Nationalite',
          value: 'Tunisienne',
        },
        {
          label: 'Ville de naissance',
          value: 'Sfax',
        },
      ],
    },
    {
      title: 'Informations de localisation',
      items: [
        {
          label: 'Ville',
          value: 'Sfax',
        },
        {
          label: 'Adresse postale',
          value: 'Route lafrane',
        },
        {
          label: 'Code postal',
          value: '3000',
        },
      ],
    },
    {
      title: 'Informations de contact',
      items: [
        {
          label: 'Email',
          value: 'ahmed@gmail.com',
        },
        {
          label: 'Telephone',
          value: '20600600',
        },
      ],
    },
  ],
};

export type CvAtsPrefill = {
  readonly prenom: string;
  readonly nom: string;
  readonly email: string;
  readonly telephone: string;
  readonly ville: string;
  readonly codePostal: string;
  readonly filiere: string;
  readonly niveau: string;
  readonly sexe: string;
  readonly nationalite: string;
};

export function buildCvAtsPrefill(
  profile: StudentProfileData,
): CvAtsPrefill {
  const profileFieldMap = new Map(
    profile.infoGroups.flatMap((group) =>
      group.items.map((item) => [item.label, item.value] as const),
    ),
  );
  const summaryFieldMap = new Map(
    profile.summaryItems.map((item) => [item.label, item.value] as const),
  );

  return {
    prenom: profile.firstName,
    nom: profile.lastName,
    email: profileFieldMap.get('Email') ?? '',
    telephone: profileFieldMap.get('Telephone') ?? '',
    ville: profileFieldMap.get('Ville') ?? '',
    codePostal: profileFieldMap.get('Code postal') ?? '',
    filiere: summaryFieldMap.get('Filiere') ?? '',
    niveau: summaryFieldMap.get('Niveau') ?? '',
    sexe: profileFieldMap.get('Sexe') ?? '',
    nationalite: profileFieldMap.get('Nationalite') ?? '',
  };
}