import React from 'react';
import * as LucideIcons from 'lucide-react';

const DynamicIcon = ({ name, size = 24, color, ...props }) => {
    // If the name is undefined, null, or not found in lucide-react, fallback to a default icon
    const IconComponent = LucideIcons[name] || LucideIcons.Package;

    return <IconComponent size={size} color={color} {...props} />;
};

export default DynamicIcon;
