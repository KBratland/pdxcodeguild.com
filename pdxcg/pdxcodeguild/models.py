from django.db import models
from django.core.validators import RegexValidator


class NewStudentApplication(models.Model):
    # regex for valid international phone number
    phone_regex = RegexValidator(regex=r'^\+?1?\d{9,15}$',
                                 message="Phone number must be entered in the format: '+999999999'. Up to 15 digits \
                                 allowed.")

    first_name = models.CharField(max_length=255)
    middle_initial = models.CharField(max_length=1)
    last_name = models.CharField(max_length=255)
    date_of_birth = models.DateField(auto_now=False)
    street_address = models.CharField(max_length=255)
    city = models.CharField(max_length=255)
    state = models.CharField(max_length=255)
    zip = models.IntegerField(max_length=5)
    applied_before = models.CharField(max_length=255)
    if_yes_app = models.DateField(auto_now=False)
    attended_before = models.CharField(max_length=255)
    if_yes_grad = models.CharField(max_length=255)
    if_no_grad = models.TextField(max_length=255)
    phone_number = models.CharField(validators=[phone_regex], blank=True, max_length=15)
    message_number = models.CharField(validators=[phone_regex], blank=True, max_length=15)
    cell_number = models.CharField(validators=[phone_regex], blank=True, max_length=15)
    email = models.EmailField()
    us_citizen = models.CharField(max_length=255)

    # Emergency Contact Information

    contact_name = models.CharField(max_length=255)
    contact_address = models.CharField(max_length=255)
    contact_city = models.CharField(max_length=255)
    contact_state = models.CharField(max_length=255)
    contact_zip = models.CharField(max_length=255)
    contact_number = models.CharField(validators=[phone_regex], blank=True, max_length=15)


class StudentIntake(models.Model):
    name = models.CharField(max_length=255)
    email_address = models.EmailField(max_length=255)
    git_hub = models.URLField(max_length=255)
    instructor_name = models.CharField(max_length=255)
    student_bio = models.TextField(max_length=2000)
    student_goals = models.TextField(max_length=2000)