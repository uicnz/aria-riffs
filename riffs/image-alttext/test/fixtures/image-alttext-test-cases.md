# Test Cases for Aria Image Alttext

This file contains various test cases for testing the alt-text-fixer script.

## Case 1: Standard Case - Empty Alt Text with Figure Caption

<!-- markdownlint-disable -->

![](media/image1.png)

Figure 1: Network Diagram with Multiple Connections

## Case 2: Image with Existing Alt Text (should be ignored)

![Existing Alt Text](media/image2.png)

Figure 2: This caption should not be used as alt text

## Case 3: Image without a Following Caption (should be ignored)

![](media/image3.png)

This is not a proper figure caption because it doesn't start with "Figure X:"

## Case 4: Multiple Images with Captions in Sequence

![](media/image4.png)

Figure 4: First Sequential Diagram

![](media/image5.png)

Figure 5: Second Sequential Diagram

## Case 5: Different Image Extensions

![](media/image6.png)

Figure 6: PNG Image Example

![](media/image7.jpg)

Figure 7: JPG Image Example

![](media/image8.jpeg)

Figure 8: JPEG Image Example

![](media/image9.gif)

Figure 9: GIF Image Example

![](media/image10.emf)

Figure 10: EMF Image Example

## Case 6: Varying Whitespace

![](media/image11.png)
Figure 11: No empty line between image and caption

![](media/image12.png)

Figure 12: Multiple empty lines between image and caption

## Case 7: Edge Cases

![](media/image13.svg)

Figure 13: Unsupported file extension (should be ignored)

![ ](media/image14.png)

Figure 14: Alt text with only whitespace (should be processed)
