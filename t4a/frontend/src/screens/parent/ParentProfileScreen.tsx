import React from 'react';
import StudentSettings from '../student/StudentSettings';

const ParentProfileScreen = ({ navigation }: any) => {
  // We can reuse StudentSettings since the logic is basically identical for the user details (name, email, photo)
  // StudentSettings fetches /auth/me or similar and allows editing the User model.
  return <StudentSettings navigation={navigation} />;
};

export default ParentProfileScreen;
