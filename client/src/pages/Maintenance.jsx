import React from 'react';
import { BiWrench } from 'react-icons/bi';
import './Maintenance.css';

const Maintenance = () => {
    return (
        <div className='maintenance-container'>
            <div className='maintenance-content'>
                <div className='maintenance-icon'>
                    <BiWrench />
                </div>
                <h1 className='maintenance-title'>Under Maintenance</h1>
                <p className='maintenance-message'>
                    We are currently performing scheduled maintenance to improve your experience.
                    We apologize for any inconvenience using Letterboard.
                    <br /><br />
                    We'll be back shortly!
                </p>
                <div className='maintenance-footer'>
                    &copy; {new Date().getFullYear()} Seriee No rights reserved.
                </div>
            </div>
        </div>
    );
};

export default Maintenance;
