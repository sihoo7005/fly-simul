import unittest

import numpy as np

from simulate import red_fraction_per_eye, walking_signal


class VisualControlTest(unittest.TestCase):
    def test_target_on_left_changes_leg_drive(self):
        image = np.zeros((2, 4, 4, 3), dtype=np.uint8)
        image[0, :2, :, 0] = 255
        left, right = red_fraction_per_eye(image)
        self.assertEqual((left, right), (0.5, 0.0))
        self.assertGreater(walking_signal(left, right)[1], walking_signal(left, right)[0])
        np.testing.assert_array_equal(walking_signal(0, 0), [0.8, 0.8])


if __name__ == "__main__":
    unittest.main()
