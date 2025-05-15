// Global variable to store the update function
let updateNavbarProfile = null;

export const setUpdateNavbarProfile = (updateFn) => {
    updateNavbarProfile = updateFn;
};

export const updateProfilePhoto = (newPhotoUrl) => {
    if (updateNavbarProfile) {
        updateNavbarProfile(newPhotoUrl);
    }
}; 